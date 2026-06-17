// Parses CC-CEDICT and bulk-uploads it into the `dictionary` table in Supabase.
//
// Usage:
//   node scripts/import-cedict-to-supabase.mjs                # dry-run (just parse + print stats)
//   node scripts/import-cedict-to-supabase.mjs --upload       # write to Supabase
//   node scripts/import-cedict-to-supabase.mjs --upload --resume HANZI  # restart from a hanzi
//
// Reads:
//   • ../ChineseLens/scripts/data/cedict.txt   (CC-CEDICT raw text)
//   • scripts/hsk-import.json (optional) — to attach hsk_level when matching hanzi exists
//   • .env                    (EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//
// CC-CEDICT line format:
//   <trad> <simp> [<pinyin_with_numbers>] /meaning 1/meaning 2/.../
//
// We collapse identical-simplified entries (a few hundred exist) into one row,
// merging meanings and picking the most common pinyin reading. Pinyin is
// normalised to:
//   • display form:  "ni3 hao3"       → "nǐ hǎo"
//   • search form:   "ni3 hao3"       → "nihao"

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
  return i >= 0 ? args[i + 1] : null;
})();
const BATCH_SIZE = 500;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (UPLOAD && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env",
  );
  process.exit(1);
}

const supabase = UPLOAD ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

// ────────────────────────────────────────────────────────────────────────────
// Pinyin tone-number → diacritic conversion
// ────────────────────────────────────────────────────────────────────────────
const TONE_MARKS = {
  a: ["a", "ā", "á", "ǎ", "à", "a"],
  e: ["e", "ē", "é", "ě", "è", "e"],
  i: ["i", "ī", "í", "ǐ", "ì", "i"],
  o: ["o", "ō", "ó", "ǒ", "ò", "o"],
  u: ["u", "ū", "ú", "ǔ", "ù", "u"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

/** Convert "ni3 hao3" → "nǐ hǎo" */
function numberedPinyinToToned(s) {
  return s
    .split(/\s+/)
    .map((syl) => {
      const m = syl.match(/^([a-zA-ZüÜ:]+)([1-5])?$/);
      if (!m) return syl;
      let base = m[1].replace(/u:/gi, "ü");
      const tone = m[2] ? parseInt(m[2], 10) : 5;
      if (tone === 5) return base.toLowerCase();
      // Tone-mark placement priority: a > e > o > i > u > ü
      const lower = base.toLowerCase();
      let target = null;
      for (const v of ["a", "e", "o", "i", "u", "ü"]) {
        if (lower.includes(v)) {
          target = v;
          break;
        }
      }
      if (!target) return lower;
      const marked = TONE_MARKS[target][tone];
      // Re-insert the marked vowel into the original lowercased base.
      const idx = lower.indexOf(target);
      return lower.slice(0, idx) + marked + lower.slice(idx + 1);
    })
    .join(" ");
}

/** Convert any pinyin form to a searchable normalised string. */
function normalizePinyin(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ü/gi, "u")
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// ────────────────────────────────────────────────────────────────────────────
// Parse CC-CEDICT
// ────────────────────────────────────────────────────────────────────────────
console.log(`Reading CC-CEDICT from ${CEDICT_PATH}`);
const cedictRaw = readFileSync(CEDICT_PATH, "utf-8");
const lines = cedictRaw.split("\n").filter((l) => l && !l.startsWith("#"));
console.log(`  ${lines.length.toLocaleString()} raw entries`);

const CEDICT_RE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/;

// Map keyed by simplified hanzi — multiple readings collapse into one row.
const dict = new Map();

for (const line of lines) {
  const m = line.match(CEDICT_RE);
  if (!m) continue;
  const [, trad, simp, pinyinRaw, meaningsRaw] = m;

  // Skip pure ASCII entries (e.g. "% %") and trivial single-punctuation rows.
  if (!/[一-鿿]/.test(simp)) continue;

  // Skip proper-noun-only entries — CEDICT marks them with a capital pinyin
  // initial. They flood search results with random names. We keep one if no
  // common variant exists for the same hanzi.
  const isProper = /^[A-Z]/.test(pinyinRaw.trim());

  const meanings = meaningsRaw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(
      // Drop the cross-reference noise CEDICT uses ("see 别的[bie2 de5]")
      // — keeps meaning lists tight. Pure cross-refs become empty.
      (s) => !/^(variant of|see\b|also written|abbr\. for)/i.test(s) || s.length > 40,
    );
  if (meanings.length === 0) continue;

  const toned = numberedPinyinToToned(pinyinRaw);
  const norm = normalizePinyin(pinyinRaw);

  const existing = dict.get(simp);
  if (existing) {
    // Prefer non-proper reading if existing is proper.
    if (existing.isProper && !isProper) {
      existing.pinyin = toned;
      existing.pinyin_norm = norm;
      existing.isProper = false;
    }
    // Append meanings, dedupe.
    const seen = new Set(existing.meanings_en);
    for (const m of meanings) {
      if (!seen.has(m)) {
        existing.meanings_en.push(m);
        seen.add(m);
      }
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

// ────────────────────────────────────────────────────────────────────────────
// Attach hsk_level for entries that also exist in HSK
// ────────────────────────────────────────────────────────────────────────────
if (existsSync(HSK_JSON_PATH)) {
  console.log("Cross-referencing HSK levels…");
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

// ────────────────────────────────────────────────────────────────────────────
// Frequency rank — proxy by hanzi length (single chars are far more common
// than 4-char idioms). Real frequency data could come later from a
// Subtlex-CH dump; this gets us 80% of the ranking benefit for free.
// ────────────────────────────────────────────────────────────────────────────
for (const entry of dict.values()) {
  const len = [...entry.hanzi].length;
  entry.freq = entry.hsk_level
    ? entry.hsk_level * 1000 + len * 100
    : 6000 + len * 1000;
}

// ────────────────────────────────────────────────────────────────────────────
// Upload
// ────────────────────────────────────────────────────────────────────────────
if (!UPLOAD) {
  console.log("\nDry run complete. Re-run with --upload to write to Supabase.");
  console.log(`Sample entries:`);
  let i = 0;
  for (const e of dict.values()) {
    if (i++ >= 5) break;
    console.log(`  ${e.hanzi}  ${e.pinyin}  [${e.meanings_en.slice(0, 2).join(" | ")}]`);
  }
  process.exit(0);
}

console.log(`\nUploading to ${SUPABASE_URL} in batches of ${BATCH_SIZE}…`);
const rows = Array.from(dict.values()).map(({ isProper, ...row }) => row);
rows.sort((a, b) => a.hanzi.localeCompare(b.hanzi));

let startIdx = 0;
if (RESUME_AT) {
  startIdx = rows.findIndex((r) => r.hanzi === RESUME_AT);
  if (startIdx < 0) {
    console.error(`Resume hanzi not found: ${RESUME_AT}`);
    process.exit(1);
  }
  console.log(`Resuming from index ${startIdx} (${RESUME_AT})`);
}

const t0 = Date.now();
let written = 0;
let failed = 0;
for (let i = startIdx; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { error } = await supabase
    .from("dictionary")
    .upsert(batch, { onConflict: "hanzi" });
  if (error) {
    console.error(
      `Batch ${i}-${i + batch.length} failed:`,
      error.message,
      `\n  resume with --resume ${batch[0].hanzi}`,
    );
    failed += batch.length;
    // Brief backoff in case it's a transient rate limit.
    await new Promise((r) => setTimeout(r, 2000));
    continue;
  }
  written += batch.length;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const pct = ((i + batch.length) / rows.length * 100).toFixed(1);
  process.stdout.write(
    `\r  ${written.toLocaleString()} written · ${failed} failed · ${pct}% · ${elapsed}s`,
  );
}
process.stdout.write("\n");

console.log(`Done. ${written.toLocaleString()} rows upserted in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
if (failed > 0) {
  console.warn(`${failed} rows failed — re-run script; upsert is idempotent.`);
}
