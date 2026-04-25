import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const outFile = join(__dirname, "hsk-import.json");

const map = new Map();

function ingest(filename, kind, level) {
  const arr = JSON.parse(readFileSync(join(dataDir, filename), "utf-8"));
  for (const w of arr) {
    if (!w.hanzi || !w.pinyin) continue;
    const cur = map.get(w.hanzi);
    if (!cur) {
      map.set(w.hanzi, {
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        hsk_old: kind === "old" ? level : null,
        hsk_new: kind === "new" ? level : null,
      });
    } else {
      if (kind === "old") {
        if (cur.hsk_old == null || level < cur.hsk_old) cur.hsk_old = level;
      } else {
        if (cur.hsk_new == null || level < cur.hsk_new) cur.hsk_new = level;
        cur.pinyin = w.pinyin;
      }
    }
  }
}

for (const lvl of [1, 2, 3, 4, 5]) ingest(`hsk${lvl}_new.json`, "new", lvl);
for (const lvl of [1, 2, 3, 4, 5, 6]) ingest(`hsk${lvl}_old.json`, "old", lvl);

const arr = [...map.values()];
writeFileSync(outFile, JSON.stringify(arr));
console.log(`Wrote ${arr.length} rows to ${outFile} (${(JSON.stringify(arr).length / 1024).toFixed(1)} KB)`);
