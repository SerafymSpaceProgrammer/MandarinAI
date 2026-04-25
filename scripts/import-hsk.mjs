// Reads data/hsk{level}_{old|new}.json, dedupes by hanzi, emits SQL inserts
// for hsk_words. New-syllabus pinyin wins on conflict (more accurate tone
// marks in the 2021 standard).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const outFile = join(__dirname, "hsk-import.sql");

const map = new Map(); // hanzi -> { pinyin, hsk_old, hsk_new }

function ingest(filename, kind, level) {
  const raw = readFileSync(join(dataDir, filename), "utf-8");
  const arr = JSON.parse(raw);
  for (const w of arr) {
    if (!w.hanzi || !w.pinyin) continue;
    const cur = map.get(w.hanzi);
    if (!cur) {
      map.set(w.hanzi, {
        pinyin: w.pinyin,
        hsk_old: kind === "old" ? level : null,
        hsk_new: kind === "new" ? level : null,
      });
    } else {
      // Take the LOWEST level seen for each kind (a word in HSK 1 and HSK 3
      // — that shouldn't happen but defensively keep the easier level).
      if (kind === "old") {
        if (cur.hsk_old == null || level < cur.hsk_old) cur.hsk_old = level;
      } else {
        if (cur.hsk_new == null || level < cur.hsk_new) cur.hsk_new = level;
      }
      // Prefer pinyin from new syllabus (more accurate tone marks).
      if (kind === "new") cur.pinyin = w.pinyin;
    }
  }
}

// Load new first (so its pinyin sticks), then old to fill in legacy levels.
for (const lvl of [1, 2, 3, 4, 5]) ingest(`hsk${lvl}_new.json`, "new", lvl);
for (const lvl of [1, 2, 3, 4, 5, 6]) ingest(`hsk${lvl}_old.json`, "old", lvl);

const rows = [...map.entries()];
rows.sort((a, b) => {
  const ao = a[1].hsk_old ?? a[1].hsk_new ?? 99;
  const bo = b[1].hsk_old ?? b[1].hsk_new ?? 99;
  if (ao !== bo) return ao - bo;
  return a[0].localeCompare(b[0]);
});

console.log(`Unique words: ${rows.length}`);

function escape(s) {
  return s.replace(/'/g, "''");
}

const BATCH_SIZE = 500;
let sql = "";
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  sql += "insert into public.hsk_words (hanzi, pinyin, hsk_old, hsk_new) values\n";
  const lines = batch.map(([hanzi, v]) => {
    const old = v.hsk_old == null ? "null" : v.hsk_old;
    const ne = v.hsk_new == null ? "null" : v.hsk_new;
    return `  ('${escape(hanzi)}', '${escape(v.pinyin)}', ${old}, ${ne})`;
  });
  sql += lines.join(",\n");
  sql +=
    "\non conflict (hanzi) do update set hsk_old = coalesce(public.hsk_words.hsk_old, excluded.hsk_old), hsk_new = coalesce(public.hsk_words.hsk_new, excluded.hsk_new), pinyin = excluded.pinyin;\n\n";
}

writeFileSync(outFile, sql, "utf-8");
console.log(`Wrote ${rows.length} rows to ${outFile} (~${Math.ceil(rows.length / BATCH_SIZE)} batches)`);
