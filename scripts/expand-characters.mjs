// Walk every HSK 1–6 word in data/hskwords_old/ and extract the unique
// hanzi that show up. For each character, derive pinyin via pinyin-pro and
// translate the meaning via Google Translate (the same unauthenticated
// endpoint the translate-meaning edge function uses). The output is a single
// SQL file with UPSERT statements that can be applied with the Supabase
// MCP — runs once, fills characters_dict to ~2.6K rows, every HSK level.
//
// Stroke counts and mnemonics are intentionally left NULL — the goal here
// is reach (every HSK char shows up in the trainer roadmap), not depth.
// Both can be backfilled later by a curated pass or by an AI-generated batch.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pinyin } from "pinyin-pro";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const cachePath = join(__dirname, "characters-meanings-cache.json");
const outDir = join(repoRoot, "supabase", "seed");

// CJK Unified Ideographs — accept the BMP block and Extension A. Other
// extension blocks are rare and not in HSK old syllabus.
const CJK_RE = /[一-鿿㐀-䶿]/;

const args = process.argv.slice(2);
function flag(n) {
  return args.includes(`--${n}`);
}
function val(n, fallback) {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const CONCURRENCY = Number(val("concurrency", "8"));
const LIMIT = Number(val("limit", "0")); // 0 = no cap
const ONLY_LEVEL = val("level", "");
const SKIP_TRANSLATE = flag("skip-translate");

// ──────────────────────────────────────────────────────────────────────────
// Cache (resumable)
// ──────────────────────────────────────────────────────────────────────────
function loadCache() {
  if (!existsSync(cachePath)) return {};
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  } catch {
    return {};
  }
}
function saveCache(cache) {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

// ──────────────────────────────────────────────────────────────────────────
// Step 1 — extract unique hanzi keyed by their first-appearance HSK level
// ──────────────────────────────────────────────────────────────────────────
function collectChars() {
  const seen = new Map(); // hanzi -> { level, rank }
  let rankCounter = 0;
  for (let level = 1; level <= 6; level++) {
    const list = JSON.parse(
      readFileSync(join(repoRoot, "data", "hskwords_old", `hsk${level}_old.json`), "utf-8"),
    );
    for (const w of list) {
      const word = String(w.hanzi ?? "");
      for (const ch of word) {
        if (!CJK_RE.test(ch)) continue;
        if (seen.has(ch)) continue;
        rankCounter += 1;
        seen.set(ch, { level, rank: rankCounter });
      }
    }
  }
  return seen;
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2 — pinyin via pinyin-pro (collect every reading for polyphones)
// ──────────────────────────────────────────────────────────────────────────
function readingsFor(hanzi) {
  try {
    const all = pinyin(hanzi, {
      toneType: "symbol",
      multiple: true,
      type: "array",
      v: true,
    });
    if (Array.isArray(all) && all.length > 0) {
      // pinyin-pro returns array of strings, possibly duplicated. Normalise.
      const uniq = Array.from(
        new Set(all.map((s) => String(s).trim()).filter(Boolean)),
      );
      return uniq;
    }
  } catch {
    // Fall through to single-reading fallback.
  }
  try {
    const one = pinyin(hanzi, { toneType: "symbol", v: true });
    const s = (Array.isArray(one) ? one.join(" ") : String(one)).trim();
    return s ? [s] : [];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3 — meanings via Google Translate (same endpoint as edge function)
// ──────────────────────────────────────────────────────────────────────────
async function googleTranslate(hanzi) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(hanzi)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const segments = (data[0] ?? []);
    const joined = segments
      .map((s) => (Array.isArray(s) ? String(s[0] ?? "") : ""))
      .join("")
      .trim();
    if (!joined) return null;
    return joined
      .split(/[;／/]|,\s/g)
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0)
      .slice(0, 5);
  } catch {
    return null;
  }
}

async function runPool(items, worker, concurrency) {
  let cursor = 0;
  let inFlight = 0;
  return new Promise((resolve, reject) => {
    let settled = false;
    function pump() {
      if (settled) return;
      while (inFlight < concurrency && cursor < items.length) {
        const item = items[cursor++];
        inFlight++;
        Promise.resolve(worker(item))
          .catch((err) => {
            settled = true;
            reject(err);
          })
          .finally(() => {
            inFlight--;
            if (settled) return;
            if (cursor >= items.length && inFlight === 0) {
              settled = true;
              resolve();
            } else {
              pump();
            }
          });
      }
    }
    pump();
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Step 4 — emit SQL
// ──────────────────────────────────────────────────────────────────────────
function sqlEscape(s) {
  return s.replace(/'/g, "''");
}
function pgArray(strs) {
  if (!strs || strs.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${strs.map((s) => `'${sqlEscape(s)}'`).join(",")}]`;
}

function emitSql(rows, outFile) {
  const lines = [];
  lines.push("-- Auto-generated by scripts/expand-characters.mjs");
  lines.push("-- Walks HSK 1–6 old syllabus, extracts every unique hanzi,");
  lines.push("-- enriches with pinyin (pinyin-pro) + EN meanings (Google).");
  lines.push("-- Stroke counts + mnemonics are intentionally NULL here — fill");
  lines.push("-- them in via a curated pass when convenient.");
  lines.push("");
  // Use a BEGIN/COMMIT to keep the catalog atomic.
  lines.push("BEGIN;");
  for (const r of rows) {
    const meaningsArr = pgArray(r.meanings.length > 0 ? r.meanings : ["—"]);
    const pinyinArr = pgArray(r.pinyin.length > 0 ? r.pinyin : [""]);
    lines.push(
      `INSERT INTO public.characters_dict (hanzi, pinyin, meanings, hsk_level, frequency_rank, stroke_count, mnemonic_en) ` +
        `VALUES ('${sqlEscape(r.hanzi)}', ${pinyinArr}, ${meaningsArr}, ${r.level}, ${r.rank}, NULL, NULL) ` +
        `ON CONFLICT (hanzi) DO UPDATE SET ` +
        `pinyin = COALESCE(public.characters_dict.pinyin, EXCLUDED.pinyin), ` +
        `meanings = CASE WHEN array_length(public.characters_dict.meanings, 1) IS NULL OR public.characters_dict.meanings = ARRAY['—'] THEN EXCLUDED.meanings ELSE public.characters_dict.meanings END, ` +
        `hsk_level = COALESCE(public.characters_dict.hsk_level, EXCLUDED.hsk_level), ` +
        `frequency_rank = COALESCE(public.characters_dict.frequency_rank, EXCLUDED.frequency_rank);`,
    );
  }
  lines.push("COMMIT;");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, lines.join("\n") + "\n");
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  const allChars = collectChars();
  console.log(`Unique HSK 1–6 hanzi: ${allChars.size}`);

  let entries = [...allChars.entries()];
  if (ONLY_LEVEL) {
    const lvl = Number(ONLY_LEVEL);
    entries = entries.filter(([, info]) => info.level === lvl);
    console.log(`Filtered to HSK ${lvl}: ${entries.length} chars`);
  }
  if (LIMIT > 0) {
    entries = entries.slice(0, LIMIT);
    console.log(`Limited to first ${LIMIT}`);
  }

  const cache = loadCache();
  const rows = [];
  let processed = 0;
  let cacheHits = 0;
  let lastSavedAt = Date.now();
  const startedAt = Date.now();

  // Pre-compute pinyin (synchronous, fast).
  const work = entries.map(([hanzi, info]) => ({
    hanzi,
    level: info.level,
    rank: info.rank,
    pinyin: readingsFor(hanzi),
  }));

  if (SKIP_TRANSLATE) {
    for (const w of work) {
      rows.push({ ...w, meanings: [] });
    }
  } else {
    await runPool(
      work,
      async (w) => {
        const cached = cache[w.hanzi];
        let meanings;
        if (cached && Array.isArray(cached.meanings)) {
          meanings = cached.meanings;
          cacheHits++;
        } else {
          meanings = (await googleTranslate(w.hanzi)) ?? [];
          cache[w.hanzi] = { meanings };
          if (Date.now() - lastSavedAt > 4000) {
            saveCache(cache);
            lastSavedAt = Date.now();
          }
        }
        rows.push({ ...w, meanings });
        processed++;
        if (processed % 100 === 0 || processed === work.length) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(
            `  ${processed}/${work.length}  (${elapsed}s, cache hits: ${cacheHits})`,
          );
        }
      },
      CONCURRENCY,
    );
  }

  saveCache(cache);

  // Sort by HSK level then frequency rank — keeps the SQL stable across runs.
  rows.sort((a, b) => a.level - b.level || a.rank - b.rank);

  const outFile = join(outDir, "characters_full.sql");
  emitSql(rows, outFile);
  console.log(`\nWrote ${outFile}  (${rows.length} rows)`);

  // Quick stats
  const byLevel = new Map();
  for (const r of rows) byLevel.set(r.level, (byLevel.get(r.level) ?? 0) + 1);
  for (const lvl of [...byLevel.keys()].sort()) {
    console.log(`  HSK ${lvl}: ${byLevel.get(lvl)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
