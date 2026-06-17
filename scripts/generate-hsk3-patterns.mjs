// Generate example phrases for the HSK 3 grammar constructions defined in
// data/patterns/_hsk3_constructions.json, across cumulative vocabulary scopes.
//
// HSK 3 grammar always assumes the learner already knows HSK 1+2 vocabulary,
// so the smallest meaningful scope is 3 (HSK 1+2+3 ≈ 600 words).
//
// Vocab scope determines which old-syllabus HSK lists are merged into the
// allowed vocabulary:
//   --vocab-scope 3  →  HSK 1+2+3  →  hsk3_patterns.json
//   --vocab-scope 4  →  HSK 1+2+3+4  →  hsk3_4_patterns.json
//   --vocab-scope 5  →  HSK 1+2+3+4+5  →  hsk3_4_5_patterns.json
//   --vocab-scope 6  →  HSK 1..6  →  hsk3_4_5_6_patterns.json
//
// Strategy — one OpenAI call per phrase, each call sees the construction
// definition + every phrase already generated for that construction so the
// model produces a NEW one, varying vocabulary and reusing the same target
// structure.
//
// Inheritance — when --vocab-scope is N > 3, the generator boots its cache
// from the previous scope's cache (V{N-1}). Phrases produced for the smaller
// scope are valid for the larger one too.
//
// Resumable: progress is written into scripts/hsk3-phrase-cache-v{N}.json
// after every successful phrase. Re-running picks up wherever it stopped.
//
// Usage:
//   node scripts/generate-hsk3-patterns.mjs --vocab-scope 3 --target 50
//   node scripts/generate-hsk3-patterns.mjs --only 1,2,3 --vocab-scope 4
//   node scripts/generate-hsk3-patterns.mjs --emit --vocab-scope 5

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const patternsDir = join(repoRoot, "data", "patterns");

// .env loader (shared pattern with translate-strings.mjs).
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
// CLI
// ──────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
  return args.includes(`--${name}`);
}
function val(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const VOCAB_SCOPE = Number(val("vocab-scope", "3"));
if (![3, 4, 5, 6].includes(VOCAB_SCOPE)) {
  throw new Error(`--vocab-scope must be 3..6, got ${VOCAB_SCOPE}`);
}
// Default target scales with scope (more vocab → more diverse phrases).
// HSK 3 grammar is richer than HSK 2 so the V123 floor is generous.
const TARGET_BY_SCOPE = { 3: 50, 4: 80, 5: 120, 6: 170 };
const TARGET_PHRASES = Number(val("target", String(TARGET_BY_SCOPE[VOCAB_SCOPE])));
const CONCURRENCY = Number(val("concurrency", "4"));
const ONLY = (() => {
  const raw = val("only", "");
  if (!raw) return null;
  return new Set(raw.split(",").map((s) => Number(s.trim())));
})();
const EMIT_ONLY = flag("emit");

// ──────────────────────────────────────────────────────────────────────────
// Scope-derived paths and labels
// ──────────────────────────────────────────────────────────────────────────
function scopeSuffix(scope) {
  // 3 → ""           (base file: hsk3_patterns.json — HSK 3 grammar + V123 vocab)
  // 4 → "_4"
  // 5 → "_4_5"
  // 6 → "_4_5_6"
  if (scope === 3) return "";
  const parts = [];
  for (let i = 4; i <= scope; i++) parts.push(String(i));
  return "_" + parts.join("_");
}
function patternsFileFor(scope) {
  return `hsk3${scopeSuffix(scope)}_patterns.json`;
}
function cacheFileFor(scope) {
  return `hsk3-phrase-cache-v${scope}.json`;
}
function scopeLabel(scope) {
  // Human-readable: HSK 1+2, HSK 1+2+3, …
  const nums = ["1"];
  for (let i = 2; i <= scope; i++) nums.push(String(i));
  return "HSK " + nums.join("+");
}

const cachePath = join(__dirname, cacheFileFor(VOCAB_SCOPE));
const outFile = patternsFileFor(VOCAB_SCOPE);

// ──────────────────────────────────────────────────────────────────────────
// Inputs
// ──────────────────────────────────────────────────────────────────────────
const constructionsFile = JSON.parse(
  readFileSync(join(patternsDir, "_hsk3_constructions.json"), "utf-8"),
);
const constructions = constructionsFile.constructions;

// Cumulative vocabulary: union of HSK 1..VOCAB_SCOPE old-syllabus lists.
const allowedWords = [];
for (let i = 1; i <= VOCAB_SCOPE; i++) {
  const ws = JSON.parse(
    readFileSync(join(repoRoot, "data", "hskwords_old", `hsk${i}_old.json`), "utf-8"),
  );
  for (const w of ws) allowedWords.push(w.hanzi);
}
const allowedHanziSet = new Set();
for (const w of allowedWords) {
  for (const ch of w) allowedHanziSet.add(ch);
}
const allowedHanziString = [...allowedHanziSet].sort().join("");

// Word list — only included in the user prompt when compact enough.
// Beyond ~1000 words it bloats every call without pulling its weight; the
// character whitelist + the model's HSK awareness do the heavy lifting at
// higher scopes.
const includeWordList = allowedWords.length <= 1000;
const allowedWordList = allowedWords.join("、");

// ──────────────────────────────────────────────────────────────────────────
// Cache + inheritance from previous scope
// ──────────────────────────────────────────────────────────────────────────
function loadCache() {
  if (existsSync(cachePath)) {
    try {
      return JSON.parse(readFileSync(cachePath, "utf-8"));
    } catch (err) {
      console.warn(`Cache parse failed (${err.message}); starting fresh.`);
    }
  }
  // Inherit from V{scope-1} on first run for any scope > 3 — phrases valid
  // in a smaller scope are valid here too.
  if (VOCAB_SCOPE > 3) {
    const prevPath = join(__dirname, cacheFileFor(VOCAB_SCOPE - 1));
    if (existsSync(prevPath)) {
      try {
        const prev = JSON.parse(readFileSync(prevPath, "utf-8"));
        const inherited = JSON.parse(JSON.stringify(prev));
        let total = 0;
        for (const id of Object.keys(inherited)) total += inherited[id].length;
        console.log(`Inherited ${total} phrases from ${cacheFileFor(VOCAB_SCOPE - 1)}.`);
        return inherited;
      } catch (err) {
        console.warn(`Inherited cache parse failed (${err.message}); starting fresh.`);
      }
    }
  }
  return {};
}
function saveCache(cache) {
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

// ──────────────────────────────────────────────────────────────────────────
// Prompting
// ──────────────────────────────────────────────────────────────────────────
const SYSTEM = `You generate example sentences for a Mandarin grammar drill app (Pattern Sprints). The user drills one construction at a time over many short sentences.

Hard rules:
1. CHARACTER WHITELIST. Every CJK character in your sentence MUST be from this set (~${allowedHanziSet.size} hanzi from ${scopeLabel(VOCAB_SCOPE)} old syllabus):
${allowedHanziString}
   No other CJK characters are permitted EVER. Before outputting, scan every hanzi against the whitelist. If even one character is not in the set, replace the whole word with a synonym whose characters are all whitelisted, OR pick a different sentence entirely.
2. The sentence MUST clearly use the target grammar construction following the given structure.
3. Sentences must be short (typically 4–10 hanzi), sound like natural everyday spoken Mandarin.
4. Pinyin: diacritic tone marks (ā á ǎ à), proper word boundaries with spaces, first letter capitalized.
5. Russian: natural everyday phrasing, not literal calque.
6. Do not repeat or paraphrase any "already generated" sentence. Vary subjects (我 / 你 / 他 / 她 / 我们 / 你们 / 他们 / proper noun), verbs, and objects across sentences.${VOCAB_SCOPE > 3 ? "\n7. Reach for vocabulary the user hasn't seen yet. Earlier phrases used a narrower HSK 1+2+3 word pool — for new phrases, prefer words from the wider HSK 1–" + VOCAB_SCOPE + " range so each example introduces something fresh, while still respecting the whitelist." : ""}
${VOCAB_SCOPE > 3 ? 8 : 7}. Output STRICT JSON: {"zh": "…", "py": "…", "ru": "…"}. No commentary.`;

function buildUserPrompt(construction, alreadyGenerated, rejected) {
  const seedsBlock = construction.seeds
    .map((s) => `  - ${s.zh}  (${s.py})  «${s.ru}»`)
    .join("\n");
  const generatedBlock =
    alreadyGenerated.length === 0
      ? "  (none yet)"
      : alreadyGenerated.map((p, i) => `  ${i + 1}. ${p.zh}`).join("\n");

  const rejectedBlock = rejected.length > 0
    ? `\nYOUR PREVIOUS ATTEMPTS (REJECTED — do not repeat these mistakes)
${rejected.map((r) => `  ✗ ${r.zh}  (${r.reason})`).join("\n")}\n`
    : "";

  const wordListBlock = includeWordList
    ? `\nALLOWED VOCABULARY (${scopeLabel(VOCAB_SCOPE)}, ${allowedWords.length} words; pick subjects/verbs/objects from this list)
${allowedWordList}\n`
    : "";

  return `TARGET CONSTRUCTION
- Name:   ${construction.name}
- Pattern structure: ${construction.pattern}
- Russian description: ${construction.ru_name}

SEED EXAMPLES (canonical usages — match this style)
${seedsBlock}

ALREADY GENERATED FOR THIS CONSTRUCTION (do NOT duplicate any of these)
${generatedBlock}
${rejectedBlock}${wordListBlock}
Generate ONE new example sentence using the target construction. Every CJK character must be in the whitelist from the system prompt. Output:
{"zh":"…","py":"…","ru":"…"}`;
}

async function generateOne(construction, alreadyGenerated, rejected = []) {
  const userMsg = buildUserPrompt(construction, alreadyGenerated, rejected);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.55,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  if (
    typeof parsed.zh !== "string" ||
    typeof parsed.py !== "string" ||
    typeof parsed.ru !== "string"
  ) {
    throw new Error(`Bad shape: ${content}`);
  }
  return { zh: parsed.zh.trim(), py: parsed.py.trim(), ru: parsed.ru.trim() };
}

// ──────────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────────
const CJK_RE = /[一-鿿]/;

function illegalHanzi(zh) {
  const out = new Set();
  for (const ch of zh) {
    if (CJK_RE.test(ch) && !allowedHanziSet.has(ch)) out.add(ch);
  }
  return [...out];
}

function isDuplicate(phrase, existing) {
  return existing.some((p) => p.zh === phrase.zh || p.ru === phrase.ru);
}

// ──────────────────────────────────────────────────────────────────────────
// Per-construction sequential pump
// ──────────────────────────────────────────────────────────────────────────
async function fillConstruction(construction, cache) {
  const id = String(construction.id);
  if (!cache[id]) cache[id] = [];
  const phrases = cache[id];

  // Seed the cache with the curated seeds on first ever fill (V123). For
  // higher scopes we already inherited V{N-1}, which itself had the seeds,
  // so we skip seeding here.
  if (VOCAB_SCOPE === 3 && phrases.length === 0) {
    for (const s of construction.seeds) {
      phrases.push({ zh: s.zh, py: s.py, ru: s.ru });
    }
  }

  let consecutiveRejects = 0;
  let attempt = 0;
  // Bigger budgets for higher scopes — there's more to explore but the model
  // also drifts more often near the boundary of the wider vocab.
  const MAX_REJECTS = VOCAB_SCOPE >= 4 ? 16 : 12;
  const MAX_ATTEMPTS = TARGET_PHRASES * 5;
  let rejectedDupes = 0;
  let rejectedIllegal = 0;
  let rejectionsForNext = [];

  while (phrases.length < TARGET_PHRASES && attempt < MAX_ATTEMPTS) {
    attempt++;
    let candidate;
    try {
      candidate = await generateOne(construction, phrases, rejectionsForNext);
    } catch (err) {
      console.warn(`  [#${id}] error: ${err.message} — retrying`);
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }

    if (isDuplicate(candidate, phrases)) {
      rejectedDupes++;
      consecutiveRejects++;
      rejectionsForNext.push({ zh: candidate.zh, reason: "duplicate of an already generated phrase" });
      if (rejectionsForNext.length > 4) rejectionsForNext.shift();
      if (consecutiveRejects >= MAX_REJECTS) {
        console.warn(`  [#${id}] ${MAX_REJECTS} rejects in a row — stopping early at ${phrases.length}`);
        break;
      }
      continue;
    }

    const illegal = illegalHanzi(candidate.zh);
    if (illegal.length > 0) {
      rejectedIllegal++;
      consecutiveRejects++;
      rejectionsForNext.push({
        zh: candidate.zh,
        reason: `contains forbidden hanzi: ${illegal.join(" ")} — these are NOT in the ${scopeLabel(VOCAB_SCOPE)} whitelist`,
      });
      if (rejectionsForNext.length > 4) rejectionsForNext.shift();
      if (consecutiveRejects >= MAX_REJECTS) {
        console.warn(`  [#${id}] ${MAX_REJECTS} rejects in a row — stopping early at ${phrases.length}`);
        break;
      }
      continue;
    }

    consecutiveRejects = 0;
    rejectionsForNext = [];
    phrases.push(candidate);
    saveCache(cache);
    if (phrases.length % 10 === 0 || phrases.length === TARGET_PHRASES) {
      console.log(`  [#${id} ${construction.name}] ${phrases.length}/${TARGET_PHRASES}`);
    }
  }

  if (rejectedDupes + rejectedIllegal > 0) {
    console.log(
      `  [#${id}] rejects — dupes:${rejectedDupes} illegal-hanzi:${rejectedIllegal}`,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cross-construction concurrency
// ──────────────────────────────────────────────────────────────────────────
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
// Emit final patterns file from the cache
// ──────────────────────────────────────────────────────────────────────────
function emit(cache) {
  const outConstructions = constructions.map((c) => {
    const phrases = (cache[String(c.id)] ?? []).map((p) => {
      const { _illegal_hanzi, ...clean } = p;
      return clean;
    });
    return {
      id: c.id,
      name: c.name,
      ru_name: c.ru_name,
      pattern: c.pattern,
      patterns: phrases,
    };
  });

  const out = {
    level: scopeLabel(VOCAB_SCOPE).replace("HSK ", "HSK3 / V"),
    title: `HSK 3 Паттерны — грамматика HSK 3, лексика ${scopeLabel(VOCAB_SCOPE)}`,
    method: "Спринт-паттерны: изоляция + интенсивность + обратная связь",
    vocabulary_constraint: `Только лексика ${scopeLabel(VOCAB_SCOPE)} (старый список, ${allowedWords.length} слов)`,
    how_to_use: [
      "Закройте поле 'zh' и 'py' (рукой/листом или таймером в тренажёре).",
      "Прочтите русское предложение и произнесите его вслух по-китайски.",
      "Откройте 'zh' и 'py' — проверьте себя.",
      "Пройдите все фразы одной конструкции подряд. Повторите 3–5 раз.",
      "С каждым проходом ускоряйтесь: 4с → 2с → 1.5с → автоматизм.",
    ],
    constructions: outConstructions,
  };

  const outPath = join(patternsDir, outFile);
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

  let totalPhrases = 0;
  let illegalCount = 0;
  for (const c of constructions) {
    const phrases = cache[String(c.id)] ?? [];
    totalPhrases += phrases.length;
    for (const p of phrases) {
      if (p._illegal_hanzi && p._illegal_hanzi.length > 0) illegalCount++;
    }
  }
  console.log(
    `\nWrote ${outPath}\n` +
      `  ${outConstructions.length} constructions, ${totalPhrases} phrases total\n` +
      (illegalCount > 0 ? `  Phrases that strayed outside whitelist: ${illegalCount}\n` : ""),
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Vocab scope: ${scopeLabel(VOCAB_SCOPE)} (${allowedWords.length} words, ${allowedHanziSet.size} chars)`);
  console.log(`Cache file:  ${cacheFileFor(VOCAB_SCOPE)}`);
  console.log(`Output file: ${outFile}`);
  console.log(`Target:      ${TARGET_PHRASES} phrases per construction`);
  console.log();

  const cache = loadCache();

  if (EMIT_ONLY) {
    emit(cache);
    return;
  }

  const queue = constructions.filter((c) => {
    if (ONLY && !ONLY.has(c.id)) return false;
    const have = (cache[String(c.id)] ?? []).length;
    return have < TARGET_PHRASES;
  });

  console.log(
    `Constructions to process: ${queue.length}/${constructions.length}\n` +
      `Concurrency (across constructions): ${CONCURRENCY}\n`,
  );

  if (queue.length === 0) {
    console.log("Nothing to do — every targeted construction has enough phrases.");
    emit(cache);
    return;
  }

  const startedAt = Date.now();
  await runPool(queue, (c) => fillConstruction(c, cache), CONCURRENCY);
  saveCache(cache);

  const dur = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\nGeneration done in ${dur}s.`);

  emit(cache);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
