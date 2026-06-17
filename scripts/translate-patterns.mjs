// Translate every Mandarin pattern phrase into EN / DE / ES / PT / PL / UK
// using gpt-4o-mini. The Russian field stays untouched (it's the curated
// source). Each unique Chinese sentence costs one API call — translations for
// all six target languages come back in a single JSON object so the prompt
// fits one round-trip per phrase.
//
// Usage:
//   node scripts/translate-patterns.mjs              # full run, all phrases
//   node scripts/translate-patterns.mjs --limit 10   # cap calls (dry-runs / sampling)
//   node scripts/translate-patterns.mjs --dry        # don't call OpenAI, just stats
//   node scripts/translate-patterns.mjs --backfill   # skip translation, only rewrite
//                                                     pattern files from the cache
//
// Resumable: every successful translation is appended to the cache file at
// scripts/patterns-translations-cache.json. Re-running picks up from there.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const patternsDir = join(repoRoot, "data", "patterns");
const cachePath = join(__dirname, "patterns-translations-cache.json");

// ──────────────────────────────────────────────────────────────────────────
// .env loader (mirrors translate-strings.mjs — no extra deps)
// ──────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────
// Targets
// ──────────────────────────────────────────────────────────────────────────
const TARGET_LANGS = {
  en: "English",
  de: "German",
  es: "Spanish (neutral, Latin-American flavored when ambiguous)",
  pt: "Portuguese (neutral, Brazilian flavored when ambiguous)",
  pl: "Polish",
  uk: "Ukrainian",
};
const TARGET_KEYS = Object.keys(TARGET_LANGS);

const PATTERN_FILES = [
  "hsk1_patterns.json",
  "hsk1_2_patterns.json",
  "hsk1_2_3_patterns.json",
  "hsk1_2_3_4_patterns.json",
  "hsk1_2_3_4_5_patterns.json",
  "hsk1_2_3_4_5_6_patterns.json",
  "hsk2_patterns.json",
  "hsk2_3_patterns.json",
  "hsk2_3_4_patterns.json",
  "hsk2_3_4_5_patterns.json",
  "hsk2_3_4_5_6_patterns.json",
  "hsk3_patterns.json",
  "hsk3_4_patterns.json",
  "hsk3_4_5_patterns.json",
  "hsk3_4_5_6_patterns.json",
];
// Files we walk to harvest unique phrases. The supersets in each grammar
// family contain every (zh, ru) pair from their smaller siblings, so we only
// need to scan the largest file per family. Files that don't exist yet
// (still being generated) are skipped silently in collectUniquePhrases.
const HARVEST_FILES = [
  "hsk1_2_3_4_5_6_patterns.json",
  "hsk2_3_4_5_6_patterns.json",
  "hsk3_4_5_6_patterns.json",
  // Smaller supersets are still scanned in case the largest file in a family
  // hasn't been generated yet — every phrase in any scope file goes into the
  // cache and only one OpenAI call is ever made per unique (zh, ru) pair.
  "hsk2_3_4_5_patterns.json",
  "hsk2_3_4_patterns.json",
  "hsk2_3_patterns.json",
  "hsk2_patterns.json",
  "hsk3_4_5_patterns.json",
  "hsk3_4_patterns.json",
  "hsk3_patterns.json",
];

// ──────────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flagLimit = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Number(args[i + 1]) || 0 : 0;
})();
const flagDry = args.includes("--dry");
const flagBackfillOnly = args.includes("--backfill");
const CONCURRENCY = (() => {
  const i = args.indexOf("--concurrency");
  return i >= 0 ? Number(args[i + 1]) || 6 : 6;
})();

// ──────────────────────────────────────────────────────────────────────────
// Cache helpers
// ──────────────────────────────────────────────────────────────────────────
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

// (zh, ru) is the canonical key — same Chinese sentence can in principle have
// different Russian phrasings across constructions, so include both.
function keyFor(zh, ru) {
  return `${zh}|${ru}`;
}

// ──────────────────────────────────────────────────────────────────────────
// OpenAI translation
// ──────────────────────────────────────────────────────────────────────────
const SYSTEM = `You are translating short Mandarin example sentences from a language-learning app into multiple target languages.

Rules:
- The Mandarin sentence is the canonical source of meaning. Use the Russian as a reference for tone and register, but if Russian and Chinese disagree, FOLLOW THE CHINESE.
- Keep register informal-everyday — the way a friend would say it, not literary.
- Preserve the same sentence type (statement / question / exclamation).
- For yes/no questions ending with 吗/呢, use a normal question without a leading "is it" filler unless natural.
- For dates, times, names of people / places: keep them naturally localised (e.g. proper Polish/Ukrainian declension; "Monday" not "Day-1").
- Do NOT translate hanzi or pinyin; those don't appear in the output anyway.
- Do NOT add notes, romanizations, or extra punctuation. One natural sentence per language.
- Output STRICT JSON only with these exact keys: en, de, es, pt, pl, uk.`;

async function translatePhrase({ zh, ru, py, ru_name, pattern_syntax }) {
  const userMsg = `Mandarin: ${zh}
Pinyin: ${py}
Russian (reference, same meaning): ${ru}
Grammar construction: ${pattern_syntax} — ${ru_name}

Translate the Mandarin sentence into all of: English (en), German (de), Spanish (es), Portuguese (pt), Polish (pl), Ukrainian (uk). Return ONLY a JSON object: {"en":"...","de":"...","es":"...","pt":"...","pl":"...","uk":"..."}`;

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
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  // Validate shape — fail loud rather than silently store partial entries.
  for (const k of TARGET_KEYS) {
    if (typeof parsed[k] !== "string" || !parsed[k].trim()) {
      throw new Error(`Missing/empty "${k}" in response: ${content}`);
    }
  }
  return parsed;
}

// ──────────────────────────────────────────────────────────────────────────
// Concurrency-limited runner
// ──────────────────────────────────────────────────────────────────────────
async function runPool(items, worker, concurrency) {
  let cursor = 0;
  let inFlight = 0;
  const total = items.length;
  return new Promise((resolve, reject) => {
    let settled = false;
    function pump() {
      if (settled) return;
      while (inFlight < concurrency && cursor < total) {
        const idx = cursor++;
        inFlight++;
        Promise.resolve(worker(items[idx], idx))
          .catch((err) => {
            settled = true;
            reject(err);
          })
          .finally(() => {
            inFlight--;
            if (settled) return;
            if (cursor >= total && inFlight === 0) {
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
// Step 1 — collect unique phrases from every HARVEST_FILES file
// ──────────────────────────────────────────────────────────────────────────
function collectUniquePhrases() {
  const seen = new Map();
  for (const fname of HARVEST_FILES) {
    const fp = join(patternsDir, fname);
    if (!existsSync(fp)) continue;
    const data = JSON.parse(readFileSync(fp, "utf-8"));
    for (const c of data.constructions) {
      for (const p of c.patterns) {
        const k = keyFor(p.zh, p.ru);
        if (!seen.has(k)) {
          seen.set(k, {
            zh: p.zh,
            ru: p.ru,
            py: p.py,
            ru_name: c.ru_name,
            pattern_syntax: c.pattern,
          });
        }
      }
    }
  }
  return seen;
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2 — backfill all six pattern files from the cache
// ──────────────────────────────────────────────────────────────────────────
function backfillFiles(cache) {
  let totalPhrases = 0;
  let totalFilled = 0;
  for (const fname of PATTERN_FILES) {
    const fp = join(patternsDir, fname);
    const data = JSON.parse(readFileSync(fp, "utf-8"));
    let fileFilled = 0;
    let fileTotal = 0;
    for (const c of data.constructions) {
      for (const p of c.patterns) {
        fileTotal++;
        const tr = cache[keyFor(p.zh, p.ru)];
        if (!tr) continue;
        for (const k of TARGET_KEYS) p[k] = tr[k];
        fileFilled++;
      }
    }
    writeFileSync(fp, JSON.stringify(data, null, 2) + "\n");
    totalPhrases += fileTotal;
    totalFilled += fileFilled;
    console.log(`  ${fname}: filled ${fileFilled}/${fileTotal}`);
  }
  console.log(`Backfilled ${totalFilled}/${totalPhrases} phrase rows across ${PATTERN_FILES.length} files.`);
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  const cache = loadCache();
  const unique = collectUniquePhrases();
  const todo = [...unique.entries()].filter(([k]) => !cache[k]);
  console.log(`Unique phrases: ${unique.size}`);
  console.log(`Cached:        ${unique.size - todo.length}`);
  console.log(`To translate:  ${todo.length}`);

  if (flagBackfillOnly) {
    console.log("\n[--backfill] Skipping translation, writing pattern files from cache…");
    backfillFiles(cache);
    return;
  }

  if (flagDry) {
    console.log("\n[--dry] Not calling OpenAI. First 3 candidates:");
    todo.slice(0, 3).forEach(([k, v]) => console.log(" ·", k, "→", v.zh));
    return;
  }

  const limit = flagLimit > 0 ? Math.min(flagLimit, todo.length) : todo.length;
  if (limit === 0 && todo.length > 0) {
    console.log("Nothing to do (limit 0).");
  }

  const slice = todo.slice(0, limit);
  console.log(`\nRunning ${slice.length} translation calls @ concurrency ${CONCURRENCY}…\n`);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();
  let lastSavedAt = Date.now();

  await runPool(
    slice,
    async ([k, p]) => {
      try {
        const tr = await translatePhrase(p);
        cache[k] = tr;
      } catch (err) {
        failed++;
        console.warn(`  ✗ ${p.zh} — ${err.message}`);
        return;
      }
      done++;
      // Periodically flush cache so a crash doesn't lose progress.
      if (Date.now() - lastSavedAt > 4000) {
        saveCache(cache);
        lastSavedAt = Date.now();
      }
      if (done % 25 === 0 || done === slice.length) {
        const pct = ((done / slice.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
        console.log(`  ${done}/${slice.length} (${pct}%)  ${elapsed}s  failures: ${failed}`);
      }
    },
    CONCURRENCY,
  );

  saveCache(cache);
  console.log(`\nTranslated ${done} phrases. Failures: ${failed}. Cache saved.`);

  console.log("\nWriting translations into pattern files…");
  backfillFiles(cache);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
