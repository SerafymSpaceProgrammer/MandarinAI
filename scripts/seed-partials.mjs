// Seed scripts/strings.<lang>.partial.json from the existing per-language
// .ts files so the next translator run only fills in newly-added keys.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

for (const lang of ["es", "pt", "ru", "zh"]) {
  const file = readFileSync(join(repoRoot, "src", "i18n", `strings.${lang}.ts`), "utf-8");
  const m = file.match(/export const \w+: Translations = (\{[\s\S]+?\n\});/);
  if (!m) {
    console.error(`[${lang}] couldn't parse`);
    continue;
  }
  // eslint-disable-next-line no-new-func
  const obj = new Function(`return (${m[1]});`)();
  const flat = flatten(obj);
  writeFileSync(
    join(__dirname, `strings.${lang}.partial.json`),
    JSON.stringify(flat),
  );
  console.log(`[${lang}] seeded ${Object.keys(flat).length} keys`);
}
