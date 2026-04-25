// One-off: classify every HSK word into 0-3 of the 25 starter topics
// using OpenAI gpt-4o-mini. Reads scripts/cedict-translations.json so the
// model has the curated CC-CEDICT meanings to reason against.
//
// Output: scripts/hsk-topic-mapping.json
//   [{ hanzi: "你好", topics: ["communication"] }, ...]
//
// Resumable: writes after every batch and skips already-classified words on
// the next run — safe to ctrl-C mid-way and re-run.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as dotenv } from "node:process";

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

void dotenv;

const TOPICS = [
  "food_drink",
  "travel",
  "family",
  "body_health",
  "time",
  "weather",
  "shopping",
  "work",
  "school",
  "sports",
  "hobbies",
  "emotions",
  "transport",
  "technology",
  "money",
  "home",
  "nature",
  "animals",
  "clothing",
  "communication",
  "places",
  "politics",
  "idioms",
  "numbers",
  "colors",
];

const TRANSLATIONS_PATH = join(__dirname, "cedict-translations.json");
const OUTPUT_PATH = join(__dirname, "hsk-topic-mapping.json");

const translations = JSON.parse(readFileSync(TRANSLATIONS_PATH, "utf-8"));
console.log(`Loaded ${translations.length} translation rows.`);

// Resume: read existing mapping if present.
const existing = existsSync(OUTPUT_PATH)
  ? JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"))
  : [];
const done = new Map(existing.map((r) => [r.hanzi, r]));
console.log(`Already classified: ${done.size} / ${translations.length}`);

const remaining = translations.filter((t) => !done.has(t.hanzi));
const BATCH = 30;

const SYSTEM_PROMPT = `You are an expert Mandarin Chinese teacher. Classify Chinese vocabulary words into thematic categories.

Available topics:
${TOPICS.map((t) => `- ${t}`).join("\n")}

Rules:
- Each word gets 0–3 topic tags (most words get 1).
- "idioms" = chéngyǔ (4-character set phrases), proverbs, fixed expressions.
- "communication" covers speaking/writing/listening verbs and language-related nouns.
- "abstract" — DON'T use this; if no concrete topic fits, return [].
- Use "places" for specific cities/countries; "travel" for transit verbs.
- "body_health" includes both anatomy AND illness/fitness verbs.
- For pure grammatical particles, conjunctions, pronouns, classifiers — return [].

Return JSON: {"results":[{"hanzi":"汉字","topics":["topic_id"]}, ...]}.`;

async function classifyBatch(rows) {
  const wordsBlock = rows
    .map((r, i) => `${i + 1}. ${r.hanzi} — ${r.meanings.slice(0, 3).join("; ")}`)
    .join("\n");

  const body = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Classify these Mandarin words:\n\n${wordsBlock}` },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty completion");
  const parsed = JSON.parse(content);
  const results = parsed.results ?? parsed.classifications ?? [];
  return results;
}

const validSet = new Set(TOPICS);

function clean(topics) {
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => String(t).trim())
    .filter((t) => validSet.has(t))
    .slice(0, 3);
}

let processed = done.size;
const total = translations.length;
const start = Date.now();

for (let i = 0; i < remaining.length; i += BATCH) {
  const slice = remaining.slice(i, i + BATCH);
  let results;
  try {
    results = await classifyBatch(slice);
  } catch (err) {
    console.error("Batch failed, retrying once:", err.message);
    await new Promise((r) => setTimeout(r, 4000));
    try {
      results = await classifyBatch(slice);
    } catch (err2) {
      console.error("Retry also failed, skipping batch:", err2.message);
      continue;
    }
  }

  for (const r of results) {
    if (!r.hanzi) continue;
    done.set(r.hanzi, { hanzi: r.hanzi, topics: clean(r.topics) });
  }
  processed += slice.length;

  // Persist after every batch.
  writeFileSync(OUTPUT_PATH, JSON.stringify([...done.values()]));

  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  const pct = ((processed / total) * 100).toFixed(1);
  console.log(`[${elapsed}s] ${processed}/${total} (${pct}%)`);

  // Polite pacing — gpt-4o-mini handles ~3 req/s easily but we don't need
  // to push it.
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`\nDone. Wrote ${done.size} mappings to ${OUTPUT_PATH}`);

// Topic distribution sanity check.
const dist = new Map();
for (const r of done.values()) {
  for (const t of r.topics) dist.set(t, (dist.get(t) ?? 0) + 1);
}
const noTopic = [...done.values()].filter((r) => r.topics.length === 0).length;
console.log(`\nNo-topic (grammatical/abstract): ${noTopic}`);
console.log("Distribution:");
for (const [t, c] of [...dist].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(15)} ${c}`);
}
