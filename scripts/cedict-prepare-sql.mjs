// Parses CC-CEDICT and emits ready-to-run SQL files chunked into N-row INSERTs.
// Output: scripts/cedict-sql/chunk-NNNN.sql (one file per chunk).
// Runner (Claude / human) then executes each file via Supabase execute_sql.
//
// Why not just upload via @supabase/supabase-js? — service_role key isn't
// available in this environment; the only ingest channel is MCP execute_sql.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const CEDICT_PATH = join(repoRoot, "..", "ChineseLens", "scripts", "data", "cedict.txt");
const HSK_JSON_PATH = join(__dirname, "hsk-import.json");
const OUT_DIR = join(__dirname, "cedict-sql");
const CHUNK_SIZE = 1000;

// Reset output dir.
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR);

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
        if (lower.includes(v)) {
          target = v;
          break;
        }
      }
      if (!target) return lower;
      const marked = TONE_MARKS[target][tone];
      const idx = lower.indexOf(target);
      return lower.slice(0, idx) + marked + lower.slice(idx + 1);
    })
    .join(" ");
}

function normalizePinyin(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ü/gi, "u")
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// SQL string literal escape: single quotes doubled.
function sqlString(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

// SQL text[] literal — `ARRAY['a', 'b', 'c']`.
function sqlArray(arr) {
  if (!arr || arr.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${arr.map(sqlString).join(", ")}]`;
}

// ────────────────────────────────────────────────────────────────────────────
// Parse
// ────────────────────────────────────────────────────────────────────────────
console.log(`Reading CC-CEDICT from ${CEDICT_PATH}`);
const cedictRaw = readFileSync(CEDICT_PATH, "utf-8");
const lines = cedictRaw
  .split("\n")
  .map((l) => l.replace(/\r$/, "")) // strip CR — CC-CEDICT ships CRLF
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
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
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

// HSK cross-ref.
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

// Frequency proxy.
for (const entry of dict.values()) {
  const len = [...entry.hanzi].length;
  entry.freq = entry.hsk_level
    ? entry.hsk_level * 1000 + len * 100
    : 6000 + len * 1000;
}

// Truncate over-long meaning lists to keep INSERT payloads sane.
const MAX_MEANINGS = 8;
const MAX_MEANING_LEN = 200;
for (const entry of dict.values()) {
  entry.meanings_en = entry.meanings_en
    .map((m) => (m.length > MAX_MEANING_LEN ? m.slice(0, MAX_MEANING_LEN - 1) + "…" : m))
    .slice(0, MAX_MEANINGS);
}

// ────────────────────────────────────────────────────────────────────────────
// Emit chunked SQL
// ────────────────────────────────────────────────────────────────────────────
const rows = Array.from(dict.values()).map(({ isProper, ...r }) => r);
rows.sort((a, b) => a.hanzi.localeCompare(b.hanzi));

const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
console.log(`Emitting ${totalChunks} chunks of ${CHUNK_SIZE} into ${OUT_DIR}`);

for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const idx = i / CHUNK_SIZE;
  const slice = rows.slice(i, i + CHUNK_SIZE);
  const values = slice.map((r) => {
    return `(${sqlString(r.hanzi)}, ${sqlString(r.trad)}, ${sqlString(r.pinyin)}, ${sqlString(r.pinyin_norm)}, ${sqlArray(r.meanings_en)}, ${r.freq}, ${r.hsk_level ?? "NULL"}, 'cedict')`;
  });
  const sql =
    `INSERT INTO public.dictionary (hanzi, trad, pinyin, pinyin_norm, meanings_en, freq, hsk_level, source) VALUES\n` +
    values.join(",\n") +
    `\nON CONFLICT (hanzi) DO UPDATE SET pinyin = EXCLUDED.pinyin, pinyin_norm = EXCLUDED.pinyin_norm, meanings_en = EXCLUDED.meanings_en, freq = EXCLUDED.freq, hsk_level = EXCLUDED.hsk_level;`;
  const fname = `chunk-${String(idx).padStart(4, "0")}.sql`;
  writeFileSync(join(OUT_DIR, fname), sql, "utf-8");
}

console.log(`Done. ${totalChunks} chunk files written to ${OUT_DIR}`);
console.log(`Each chunk is ~${CHUNK_SIZE} rows.`);
