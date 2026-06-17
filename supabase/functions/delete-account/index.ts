// delete-account — MandarinAI edge function
//
// Deletes the calling user's account end-to-end:
//   1. Explicit DELETE in public tables (defensive — covers tables that
//      may not have ON DELETE CASCADE wired up to auth.users)
//   2. auth.admin.deleteUser via the GoTrue admin REST endpoint
//
// Required by Apple App Store Review Guideline 5.1.1(v): apps that allow
// account creation must also let users initiate deletion in-app.
//
// Deployed with --no-verify-jwt; verifies the caller manually against
// GoTrue /user (ES256 gateway gotcha per the feedback memory).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function verifyJwt(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id: string };
  return { userId: user.id };
}

/**
 * Delete all rows in `table` where `column = userId` using the service role.
 * Idempotent — returns true even when there were 0 matching rows. Logs and
 * returns false on transport errors so callers can surface a partial state.
 */
async function deleteByUserColumn(
  table: string,
  column: string,
  userId: string,
): Promise<{ ok: boolean; status: number }> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=minimal",
    },
  });
  return { ok: res.ok, status: res.status };
}

async function deleteAuthUser(userId: string): Promise<{ ok: boolean; status: number; body?: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (res.ok) return { ok: true, status: res.status };
  const body = await res.text().catch(() => "");
  return { ok: false, status: res.status, body: body.slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await verifyJwt(req);
  if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
  const userId = auth.userId;

  // 1) Public-schema deletes. Order is from leaf tables toward profiles so
  //    even if the CASCADE chain is partial we don't strand orphans.
  //    Each call is independent — we collect failures rather than abort,
  //    because partial cleanup is still better than nothing for compliance.
  const deletions = [
    { table: "user_characters", column: "user_id" },
    { table: "daily_activity", column: "user_id" },
    { table: "saved_words", column: "user_id" },
    { table: "profiles", column: "id" },
  ];
  const failures: Array<{ table: string; status: number }> = [];
  for (const d of deletions) {
    const res = await deleteByUserColumn(d.table, d.column, userId);
    if (!res.ok) {
      console.warn(`delete ${d.table} failed`, res.status);
      failures.push({ table: d.table, status: res.status });
    }
  }

  // 2) Finally remove the auth.users row. After this, any further
  //    public-table CASCADE will also fire (cleaning anything we missed).
  const authRes = await deleteAuthUser(userId);
  if (!authRes.ok) {
    return jsonResponse(
      {
        error: "auth_delete_failed",
        status: authRes.status,
        detail: authRes.body,
        partial_cleanup: failures,
      },
      502,
    );
  }

  return jsonResponse({ ok: true, partial_failures: failures });
});
