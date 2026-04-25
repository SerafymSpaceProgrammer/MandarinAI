// One-off: translate the EN master dictionary in src/i18n/strings.en.ts into
// es / pt / ru / zh via gpt-4o-mini, preserving {placeholder} tokens. Output
// goes into src/i18n/strings.<lang>.ts and the combined registry is hand-
// stitched in src/i18n/strings.ts.
//
// Resumable: keeps a per-language scratch file so re-running picks up where
// it left off.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// .env loader (no extra dep)
const envText = readFileSync(join(repoRoot, ".env"), "utf-8");
const env = Object.fromEntries(
  envText.split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);
const OPENAI_KEY = env.EXPO_PUBLIC_OPENAI_API_KEY;
if (!OPENAI_KEY) throw new Error("EXPO_PUBLIC_OPENAI_API_KEY not in .env");

const TARGET_LANGS = {
  es: "Spanish",
  pt: "Portuguese (European/standard)",
  ru: "Russian",
  zh: "Simplified Chinese (Mainland)",
};

// Inline import the EN dict — Node ESM tsx loader isn't around so we eval the
// file's exported literal. Easier path: re-declare a parser by importing the
// .ts as text and matching the trailing `as const` literal. Even simpler: a
// dynamic import via tsx/esbuild would require extra deps, so we just re-
// export the literal as plain JSON via a sibling `.json` mirror that the
// build step keeps in sync. Pragmatic answer for now: we mirror the EN dict
// in a separate JSON to avoid the .ts parsing problem.
const enJsonPath = join(__dirname, "strings.en.json");
if (!existsSync(enJsonPath)) {
  console.error(`Missing ${enJsonPath}. Run \`node scripts/sync-en-json.mjs\` first.`);
  process.exit(1);
}
const EN = JSON.parse(readFileSync(enJsonPath, "utf-8"));

// Flatten { common:{back:"Back"}, ... } → { "common.back": "Back", ... }
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

function unflatten(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!(p in cur)) cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = v;
  }
  return out;
}

const enFlat = flatten(EN);
const keys = Object.keys(enFlat);
console.log(`EN keys to translate: ${keys.length}`);

const SYSTEM = `You are a UI string translator for a mobile app that teaches Mandarin Chinese.
You translate English UI strings into the target language with these rules:

1. PRESERVE all {placeholder} tokens VERBATIM. Don't translate or modify them.
   They get filled in at runtime with values like numbers or names.
2. Keep the SAME tone — concise, friendly, mobile-app voice.
3. Don't translate Chinese characters (hanzi/pinyin) embedded in strings — leave 你好, 汉字, 加油, etc.
4. Match plural forms naturally; some keys end in *One/*Other for singular/plural variants.
5. Don't translate "HSK", "AI", "ChineseLens", "MandarinAI", "Whisper", "Skia", "API" — these are product/brand names.
6. For Russian: use ё where appropriate.
7. For Chinese: use Simplified, Mainland conventions.
8. Output ONLY a JSON object: {"key.path": "translated string", ...}.
   The keys are EXACTLY the input keys.`;

const BATCH_SIZE = 60;

async function translateBatch(targetLang, langName, slice) {
  const userMsg = `Translate these UI strings into ${langName}. Return JSON {"key": "translation", ...}.

${JSON.stringify(slice, null, 2)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

const outDir = join(repoRoot, "src", "i18n");
mkdirSync(outDir, { recursive: true });

for (const [code, name] of Object.entries(TARGET_LANGS)) {
  const scratchPath = join(__dirname, `strings.${code}.partial.json`);
  const acc = existsSync(scratchPath) ? JSON.parse(readFileSync(scratchPath, "utf-8")) : {};
  const remainingKeys = keys.filter((k) => !(k in acc));
  console.log(`\n[${code}] ${Object.keys(acc).length}/${keys.length} cached, ${remainingKeys.length} to go`);

  for (let i = 0; i < remainingKeys.length; i += BATCH_SIZE) {
    const batchKeys = remainingKeys.slice(i, i + BATCH_SIZE);
    const slice = Object.fromEntries(batchKeys.map((k) => [k, enFlat[k]]));

    let translated;
    try {
      translated = await translateBatch(code, name, slice);
    } catch (err) {
      console.warn(`[${code}] batch ${i}: ${err.message} — retry`);
      await new Promise((r) => setTimeout(r, 4000));
      try {
        translated = await translateBatch(code, name, slice);
      } catch (err2) {
        console.error(`[${code}] batch ${i} retry failed, skipping`);
        continue;
      }
    }

    Object.assign(acc, translated);
    writeFileSync(scratchPath, JSON.stringify(acc));
    const pct = ((Object.keys(acc).length / keys.length) * 100).toFixed(1);
    console.log(`[${code}] +${batchKeys.length} (${pct}%)`);
    await new Promise((r) => setTimeout(r, 200));
  }

  // Fill in any missed keys with EN fallback so the dict has full coverage.
  for (const k of keys) if (!(k in acc)) acc[k] = enFlat[k];

  // Write per-language .ts file.
  const nested = unflatten(acc);
  const tsBody = `// Auto-generated by scripts/translate-strings.mjs. Do not edit manually —
// edit src/i18n/strings.en.ts and re-run the script.
import type { Translations } from "./strings.en";

export const ${code.toUpperCase()}: Translations = ${JSON.stringify(nested, null, 2)};
`;
  writeFileSync(join(outDir, `strings.${code}.ts`), tsBody);
  console.log(`[${code}] wrote strings.${code}.ts`);
}

console.log("\nAll done. Next: stitch into src/i18n/strings.ts");
