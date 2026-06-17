// Translate each grammar construction's Russian description (`ru_name`) into
// EN / DE / ES / PT / PL / UK with gpt-4o-mini, then write a `name_i18n`
// object onto every construction across all pattern files. The Russian field
// stays the curated source; `name_i18n.ru` mirrors it so the runtime resolver
// has a single uniform shape to read.
//
// Usage:
//   node scripts/translate-construction-names.mjs            # full run
//   node scripts/translate-construction-names.mjs --dry      # stats only, no API
//   node scripts/translate-construction-names.mjs --backfill # rewrite files from cache
//
// Resumable: every translation is appended to
// scripts/construction-names-cache.json keyed by the ru_name string. The same
// construction appears in many cumulative files but shares one ru_name, so
// each unique description costs exactly one API call.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const patternsDir = join(repoRoot, "data", "patterns");
const cachePath = join(__dirname, "construction-names-cache.json");

// ── .env loader (mirrors translate-patterns.mjs) ───────────────────────────
const envText = readFileSync(join(repoRoot, ".env"), "utf-8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const OPENAI_KEY = env.EXPO_PUBLIC_OPENAI_API_KEY;
if (!OPENAI_KEY) throw new Error("EXPO_PUBLIC_OPENAI_API_KEY missing in .env");

const TARGET_LANGS = {
  en: "English",
  de: "German",
  es: "Spanish (neutral, Latin-American flavored when ambiguous)",
  pt: "Portuguese (neutral, Brazilian flavored when ambiguous)",
  pl: "Polish",
  uk: "Ukrainian",
};
const TARGET_KEYS = Object.keys(TARGET_LANGS);

const args = process.argv.slice(2);
const flagDry = args.includes("--dry");
const flagBackfillOnly = args.includes("--backfill");
const CONCURRENCY = 6;

// Every pattern file in the directory — they all carry constructions with
// ru_name, and the same construction repeats across cumulative scopes.
const PATTERN_FILES = readdirSync(patternsDir).filter((f) =>
  f.endsWith("_patterns.json"),
);

function loadCache() {
  if (!existsSync(cachePath)) return {};
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  } catch (err) {
    console.warn(`Cache parse failed (${err.message}); starting fresh.`);
    return {};
  }
}
function saveCache(cache) {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

const SYSTEM = `You are translating short grammar-construction labels for a Mandarin learning app.

Each label names a Chinese grammar pattern (the Chinese form is given for context). The Russian text is the curated source meaning. Translate it into the target languages.

Rules:
- Keep it a concise NOUN-PHRASE label, not a sentence. No trailing period.
- Preserve guillemets/quotes around the key word if present (e.g. «быть» → "to be" / „sein" style is fine; plain quotes are acceptable).
- Keep grammar terminology natural for each language (e.g. "copula", "measure word", "aspect particle").
- Do NOT translate hanzi or pinyin embedded in the label — leave them as-is.
- Output STRICT JSON only with these exact keys: en, de, es, pt, pl, uk.`;

async function translateName({ ru_name, zh_name, pattern }) {
  const userMsg = `Chinese construction: ${zh_name}
Pattern syntax: ${pattern}
Russian label (source meaning): ${ru_name}

Translate the label into: English (en), German (de), Spanish (es), Portuguese (pt), Polish (pl), Ukrainian (uk). Return ONLY: {"en":"...","de":"...","es":"...","pt":"...","pl":"...","uk":"..."}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices?.[0]?.message?.content);
  for (const k of TARGET_KEYS) {
    if (typeof parsed[k] !== "string" || !parsed[k].trim()) {
      throw new Error(`Missing/empty "${k}": ${JSON.stringify(parsed)}`);
    }
  }
  return parsed;
}

async function runPool(items, worker, concurrency) {
  let cursor = 0, inFlight = 0;
  const total = items.length;
  return new Promise((resolve, reject) => {
    let settled = false;
    function pump() {
      if (settled) return;
      while (inFlight < concurrency && cursor < total) {
        const idx = cursor++;
        inFlight++;
        Promise.resolve(worker(items[idx], idx))
          .catch((err) => { settled = true; reject(err); })
          .finally(() => {
            inFlight--;
            if (settled) return;
            if (cursor >= total && inFlight === 0) { settled = true; resolve(); }
            else pump();
          });
      }
    }
    pump();
  });
}

// Step 1 — harvest unique ru_name → { zh_name, pattern } for prompt context.
function collectUnique() {
  const seen = new Map();
  for (const fname of PATTERN_FILES) {
    const data = JSON.parse(readFileSync(join(patternsDir, fname), "utf-8"));
    for (const c of data.constructions ?? []) {
      if (c.ru_name && !seen.has(c.ru_name)) {
        seen.set(c.ru_name, { zh_name: c.name ?? "", pattern: c.pattern ?? "" });
      }
    }
  }
  return seen;
}

const cache = loadCache();
const unique = collectUnique();
console.log(`Unique ru_name labels: ${unique.size}`);
console.log(`Cached already: ${Object.keys(cache).length}`);

const todo = [...unique.entries()].filter(([ru]) => !cache[ru]);
console.log(`To translate: ${todo.length}`);

if (flagDry) {
  console.log("--dry: stopping before API calls.");
  process.exit(0);
}

// Step 2 — translate the missing ones.
if (!flagBackfillOnly && todo.length > 0) {
  let done = 0;
  await runPool(
    todo,
    async ([ru_name, ctx]) => {
      const out = await translateName({ ru_name, ...ctx });
      cache[ru_name] = { ru: ru_name, ...out };
      done++;
      if (done % 10 === 0 || done === todo.length) {
        saveCache(cache);
        console.log(`  ${done}/${todo.length}`);
      }
    },
    CONCURRENCY,
  );
  saveCache(cache);
  console.log("Translation done.");
}

// Step 3 — write name_i18n onto every construction in every file.
let filesWritten = 0, entriesPatched = 0;
for (const fname of PATTERN_FILES) {
  const fp = join(patternsDir, fname);
  const data = JSON.parse(readFileSync(fp, "utf-8"));
  let changed = false;
  for (const c of data.constructions ?? []) {
    const entry = c.ru_name ? cache[c.ru_name] : null;
    if (!entry) continue;
    c.name_i18n = {
      ru: entry.ru,
      en: entry.en,
      de: entry.de,
      es: entry.es,
      pt: entry.pt,
      pl: entry.pl,
      uk: entry.uk,
    };
    entriesPatched++;
    changed = true;
  }
  if (changed) {
    writeFileSync(fp, JSON.stringify(data, null, 2) + "\n");
    filesWritten++;
  }
}
console.log(`Wrote name_i18n into ${entriesPatched} entries across ${filesWritten} files.`);
