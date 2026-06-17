// Parses CC-CEDICT and uploads it to Supabase via the
// `import_dictionary_batch(jsonb)` RPC. Uses anon key — the RPC itself runs
// SECURITY DEFINER so it has the privileges to write into `dictionary`.
//
// Run:
//   node scripts/cedict-upload-via-rpc.mjs              # parse + dry-run report
//   node scripts/cedict-upload-via-rpc.mjs --upload     # actually upload
//   node scripts/cedict-upload-via-rpc.mjs --upload --resume INDEX

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
loadEnv({ path: join(repoRoot, ".env") });

const CEDICT_PATH = join(repoRoot, "..", "ChineseLens", "scripts", "data", "cedict.txt");
const HSK_JSON_PATH = join(__dirname, "hsk-import.json");

const args = process.argv.slice(2);
const UPLOAD = args.includes("--upload");
const RESUME_AT = (() => {
  const i = args.indexOf("--resume");
  return i >= 0 ? parseInt(args[i + 1], 10) || 0 : 0;
})();
const BATCH_SIZE = 1000;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (UPLOAD && (!SUPABASE_URL || !ANON_KEY)) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = UPLOAD ? createClient(SUPABASE_URL, ANON_KEY) : null;

// ─────────────────────────────────────── Pinyin helpers ──────────────────
const TONE_MARKS = {
  a: ["a", "ā", "á", "ǎ", "à", "a"],
  e: ["e", "ē", "é", "ě", "è", "e"],
  i: ["i", "ī", "í", "ǐ", "ì", "i"],
  o: ["o", "ō", "ó", "ǒ", "ò", "o"],
  u: ["u", "ū", "ú", "ǔ", "ù", "u"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};
function numberedPinyinToToned(s) {
  return s
    .split(/\s+/)
    .map((syl) => {
      const m = syl.match(/^([a-zA-ZüÜ:]+)([1-5])?$/);
      if (!m) return syl;
      let base = m[1].replace(/u:/gi, "ü");
      const tone = m[2] ? parseInt(m[2], 10) : 5;
      if (tone === 5) return base.toLowerCase();
      const lower = base.toLowerCase();
      let target = null;
      for (const v of ["a", "e", "o", "i", "u", "ü"]) {
        if (lower.includes(v)) { target = v; break; }
      }
      if (!target) return lower;
      const marked = TONE_MARKS[target][tone];
      const idx = lower.indexOf(target);
      return lower.slice(0, idx) + marked + lower.slice(idx + 1);
    })
    .join(" ");
}
function normalizePinyin(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ü/gi, "u")
    .replace(/[0-9]/g, "").replace(/\s+/g, "").toLowerCase();
}

// ───────────────────────────────────────── Parse ─────────────────────────
console.log(`Reading CC-CEDICT from ${CEDICT_PATH}`);
const cedictRaw = readFileSync(CEDICT_PATH, "utf-8");
const lines = cedictRaw
  .split("\n")
  .map((l) => l.replace(/\r$/, ""))
  .filter((l) => l && !l.startsWith("#"));
console.log(`  ${lines.length.toLocaleString()} raw entries`);

const CEDICT_RE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/;
const dict = new Map();

for (const line of lines) {
  const m = line.match(CEDICT_RE);
  if (!m) continue;
  const [, trad, simp, pinyinRaw, meaningsRaw] = m;
  if (!/[一-鿿]/.test(simp)) continue;
  const isProper = /^[A-Z]/.test(pinyinRaw.trim());

  const meanings = meaningsRaw
    .split("/").map((s) => s.trim()).filter(Boolean)
    .filter((s) => !/^(variant of|see\b|also written|abbr\. for)/i.test(s) || s.length > 40);
  if (meanings.length === 0) continue;

  const toned = numberedPinyinToToned(pinyinRaw);
  const norm = normalizePinyin(pinyinRaw);
  const existing = dict.get(simp);
  if (existing) {
    if (existing.isProper && !isProper) {
      existing.pinyin = toned;
      existing.pinyin_norm = norm;
      existing.isProper = false;
    }
    const seen = new Set(existing.meanings_en);
    for (const m of meanings) {
      if (!seen.has(m)) { existing.meanings_en.push(m); seen.add(m); }
    }
  } else {
    dict.set(simp, {
      hanzi: simp,
      trad: trad !== simp ? trad : null,
      pinyin: toned,
      pinyin_norm: norm,
      meanings_en: meanings,
      isProper,
    });
  }
}
console.log(`  ${dict.size.toLocaleString()} unique simplified entries`);

if (existsSync(HSK_JSON_PATH)) {
  const hskRows = JSON.parse(readFileSync(HSK_JSON_PATH, "utf-8"));
  let tagged = 0;
  for (const row of hskRows) {
    const target = dict.get(row.hanzi);
    if (!target) continue;
    target.hsk_level = row.hsk_new ?? row.hsk_old ?? null;
    if (target.hsk_level) tagged++;
  }
  console.log(`  ${tagged.toLocaleString()} entries tagged with hsk_level`);
}

for (const entry of dict.values()) {
  const len = [...entry.hanzi].length;
  entry.freq = entry.hsk_level
    ? entry.hsk_level * 1000 + len * 100
    : 6000 + len * 1000;
}

const MAX_MEANINGS = 8;
const MAX_MEANING_LEN = 200;
for (const entry of dict.values()) {
  entry.meanings_en = entry.meanings_en
    .map((m) => (m.length > MAX_MEANING_LEN ? m.slice(0, MAX_MEANING_LEN - 1) + "…" : m))
    .slice(0, MAX_MEANINGS);
}

const rows = Array.from(dict.values()).map(({ isProper, ...r }) => r);
rows.sort((a, b) => a.hanzi.localeCompare(b.hanzi));

if (!UPLOAD) {
  console.log("\nDry run complete. Re-run with --upload to write to Supabase.");
  process.exit(0);
}

// ───────────────────────────────────────── Upload ────────────────────────
console.log(`\nUploading via import_dictionary_batch RPC, batches of ${BATCH_SIZE}…`);

const t0 = Date.now();
let totalInserted = 0;
let failed = 0;
for (let i = RESUME_AT * BATCH_SIZE; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
    hanzi: r.hanzi,
    trad: r.trad ?? "",
    pinyin: r.pinyin,
    pinyin_norm: r.pinyin_norm,
    meanings_en: r.meanings_en,
    freq: r.freq,
    hsk_level: r.hsk_level == null ? "" : String(r.hsk_level),
    source: "cedict",
  }));

  const batchIdx = Math.floor(i / BATCH_SIZE);
  const { data, error } = await supabase.rpc("import_dictionary_batch", { rows: batch });
  if (error) {
    console.error(`\nBatch #${batchIdx} (rows ${i}-${i + batch.length}) failed:`, error.message);
    console.error(`  resume with --resume ${batchIdx}`);
    failed += batch.length;
    await new Promise((r) => setTimeout(r, 2000));
    continue;
  }
  totalInserted += typeof data === "number" ? data : batch.length;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const pct = (((i + batch.length) / rows.length) * 100).toFixed(1);
  process.stdout.write(
    `\r  batch #${batchIdx}/${Math.ceil(rows.length / BATCH_SIZE) - 1} · ${totalInserted.toLocaleString()} written · ${failed} failed · ${pct}% · ${elapsed}s`,
  );
}
process.stdout.write("\n");
console.log(
  `Done. ${totalInserted.toLocaleString()} rows upserted in ${((Date.now() - t0) / 1000).toFixed(1)}s.`,
);
if (failed > 0) console.warn(`${failed} rows failed.`);
