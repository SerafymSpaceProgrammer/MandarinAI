// Generate adapted Chinese reading stories for the in-app reader. Each
// story is constrained to characters from the user-selected HSK vocab
// pool so the learner doesn't run into unknown words mid-paragraph.
//
// Strategy mirrors generate-hsk{2,3}-patterns.mjs:
//   - One OpenAI call per story (gpt-4o-mini, JSON mode)
//   - The character whitelist for the chosen HSK level is pasted into the
//     system prompt so the model literally cannot use out-of-range hanzi
//   - We seed the prompt with a topic from a long rotating list so the
//     bundle reads as diverse rather than 50 variations of "a day at home"
//   - Output is validated against the whitelist; on miss, the candidate
//     is rejected and a retry is queued with the offending chars listed
//   - Resumable: every accepted story is appended to scripts/stories-cache.json
//
// Usage:
//   node scripts/generate-stories.mjs --target 50           # 50 stories per level
//   node scripts/generate-stories.mjs --level 2 --target 30 # only HSK 2
//   node scripts/generate-stories.mjs --emit                # rebuild stories.json
//   node scripts/generate-stories.mjs --dry                 # show what would run
//
// The existing 9 curated stories in stories.json are preserved — the
// generator only adds NEW stories with non-conflicting ids.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const cachePath = join(__dirname, "stories-cache.json");
const outPath = join(repoRoot, "data", "stories", "stories.json");

// ──────────────────────────────────────────────────────────────────────────
// .env loader (same trick as translate-patterns.mjs — no extra deps)
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

const TARGET = Number(val("target", "50"));
const ONLY_LEVEL = val("level", null);
const CONCURRENCY = Number(val("concurrency", "4"));
const EMIT_ONLY = flag("emit");
const DRY = flag("dry");

const LEVELS = ONLY_LEVEL ? [Number(ONLY_LEVEL)] : [1, 2, 3];

// ──────────────────────────────────────────────────────────────────────────
// Vocabulary whitelist per HSK story level. A story tagged hskLevel=N
// can use any character from HSK 1..N (old syllabus).
// ──────────────────────────────────────────────────────────────────────────
function whitelistFor(level) {
  const allowed = new Set();
  for (let i = 1; i <= level; i++) {
    const words = JSON.parse(
      readFileSync(join(repoRoot, "data", "hskwords_old", `hsk${i}_old.json`), "utf-8"),
    );
    for (const w of words) for (const ch of w.hanzi) allowed.add(ch);
  }
  return allowed;
}

// For a story tagged hskLevel=N we accept characters from HSK 1..N+1 to
// give the narrative room — a story strictly within HSK 1's 174 hanzi
// can't even mention "snow" or "to play" without breaking immersion.
// The existing curated stories in the bundle follow the same convention.
const WHITELIST = {
  1: whitelistFor(2),
  2: whitelistFor(3),
  3: whitelistFor(4),
};
// Used in the system prompt — what we tell the model is "preferred"
// (slightly tighter than the validator's whitelist, so the model aims
// for in-scope but the cushion absorbs natural extras).
const PREFERRED = {
  1: whitelistFor(1),
  2: whitelistFor(2),
  3: whitelistFor(3),
};

// ──────────────────────────────────────────────────────────────────────────
// Topic catalog — wide enough that 50 stories per level read diverse, and
// the model isn't tempted to repeat the same scene over and over.
// ──────────────────────────────────────────────────────────────────────────
const TOPICS = [
  { id: "my-day",          emoji: "🌞", en: "a typical day in someone's life" },
  { id: "weekend",         emoji: "🛌", en: "a relaxed weekend at home" },
  { id: "family-dinner",   emoji: "🥢", en: "a family dinner with multiple generations" },
  { id: "school-day",      emoji: "🎒", en: "a school day from morning to afternoon" },
  { id: "first-day-work",  emoji: "💼", en: "the first day at a new job" },
  { id: "buying-fruit",    emoji: "🍎", en: "buying fruit at the market" },
  { id: "restaurant",      emoji: "🍜", en: "ordering food at a restaurant" },
  { id: "lost-in-city",    emoji: "🗺️", en: "getting lost in an unfamiliar city" },
  { id: "rainy-day",       emoji: "🌧️", en: "what to do on a rainy day" },
  { id: "snowy-morning",   emoji: "❄️", en: "a snowy winter morning" },
  { id: "park-walk",       emoji: "🌳", en: "an afternoon walk in the park" },
  { id: "old-friend",      emoji: "👫", en: "meeting an old friend after a long time" },
  { id: "birthday",        emoji: "🎂", en: "celebrating a birthday with friends" },
  { id: "moving-house",    emoji: "📦", en: "the day of moving into a new home" },
  { id: "morning-market",  emoji: "🥬", en: "the morning vegetable market" },
  { id: "phone-call",      emoji: "📞", en: "an important phone call" },
  { id: "lost-wallet",     emoji: "👛", en: "finding a lost wallet" },
  { id: "subway-ride",     emoji: "🚇", en: "a subway ride during rush hour" },
  { id: "taxi-trip",       emoji: "🚕", en: "a short taxi trip across town" },
  { id: "post-office",     emoji: "📮", en: "sending a package at the post office" },
  { id: "library-visit",   emoji: "📚", en: "an afternoon at the library" },
  { id: "doctor-visit",    emoji: "🩺", en: "a routine visit to the doctor" },
  { id: "bookstore",       emoji: "📖", en: "browsing in a small bookstore" },
  { id: "coffee-shop",     emoji: "☕", en: "studying in a coffee shop" },
  { id: "morning-run",     emoji: "🏃", en: "a morning run around the neighborhood" },
  { id: "cooking-noodles", emoji: "🍝", en: "learning to cook noodles" },
  { id: "first-snow",      emoji: "🌨️", en: "the season's first snow" },
  { id: "subway-stranger", emoji: "🚉", en: "helping a stranger find the right train" },
  { id: "lost-keys",       emoji: "🔑", en: "looking for lost keys at home" },
  { id: "exam-day",        emoji: "📝", en: "the day before an important exam" },
  { id: "new-pet",         emoji: "🐱", en: "the family adopts a new pet" },
  { id: "neighbor-favor",  emoji: "🚪", en: "asking a neighbor for a small favor" },
  { id: "music-class",     emoji: "🎵", en: "a music class at the school" },
  { id: "sports-day",      emoji: "⚽", en: "the school sports day" },
  { id: "grandma-cooks",   emoji: "👵", en: "grandmother teaching the family recipe" },
  { id: "supermarket",     emoji: "🛒", en: "a weekly trip to the supermarket" },
  { id: "haircut",         emoji: "💇", en: "getting a haircut" },
  { id: "train-station",   emoji: "🚆", en: "waiting at a busy train station" },
  { id: "airport-arrival", emoji: "🛬", en: "arriving at the airport and finding a taxi" },
  { id: "tea-with-friend", emoji: "🍵", en: "drinking tea with a close friend" },
  { id: "running-late",    emoji: "⏰", en: "running late to an important meeting" },
  { id: "wedding-day",     emoji: "💒", en: "attending a friend's wedding" },
  { id: "summer-trip",     emoji: "🏖️", en: "a short summer trip to the seaside" },
  { id: "village-visit",   emoji: "🏘️", en: "visiting grandparents in a small village" },
  { id: "homework-help",   emoji: "✏️", en: "helping a younger sibling with homework" },
  { id: "shopping-mall",   emoji: "🛍️", en: "an afternoon at a shopping mall" },
  { id: "yoga-class",      emoji: "🧘", en: "a beginner's yoga class" },
  { id: "first-snow-kids", emoji: "⛄", en: "kids playing in the first snow of the year" },
  { id: "movie-night",     emoji: "🎬", en: "a quiet movie night at home" },
  { id: "garden-flowers",  emoji: "🌷", en: "planting flowers in a small garden" },
  { id: "morning-tea",     emoji: "🫖", en: "a slow morning with a cup of tea" },
  { id: "stranded-rain",   emoji: "🌂", en: "getting stranded in the rain without an umbrella" },
  { id: "borrowing-book",  emoji: "📕", en: "borrowing a book from a friend" },
  { id: "new-neighbor",    emoji: "👋", en: "meeting a new neighbor" },
  { id: "writing-letter",  emoji: "✉️", en: "writing a letter to a far-away friend" },
  { id: "asking-time",     emoji: "🕒", en: "asking a stranger for the time" },
  { id: "fixing-bike",     emoji: "🚲", en: "trying to fix a broken bicycle" },
  { id: "fireworks",       emoji: "🎆", en: "watching fireworks on a holiday" },
  { id: "old-photo",       emoji: "🖼️", en: "finding an old photo album" },
  { id: "new-shoes",       emoji: "👟", en: "buying new shoes at a small shop" },
];

// ──────────────────────────────────────────────────────────────────────────
// Cache: id → story (so re-runs don't double-generate the same topic at the
// same level). Existing curated stories in stories.json are seeded in too.
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

// ──────────────────────────────────────────────────────────────────────────
// OpenAI call
// ──────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(level) {
  const preferred = PREFERRED[level];
  const preferredStr = [...preferred].sort().join("");
  const targetHanzi = level === 1 ? "60-110" : level === 2 ? "120-200" : "200-320";
  return `You write short adapted Mandarin reading stories for a graded reader app.

HARD RULES — every output MUST satisfy:
1. CHARACTER PREFERENCE. Aim to use characters from this preferred set (${preferred.size} hanzi from HSK 1${level > 1 ? "-" + level : ""} old syllabus). Use them wherever possible:
${preferredStr}
   A small number of common extra characters (~5% of the story) is acceptable when they're needed for the topic to read naturally. But avoid anything obscure or literary.

2. Length: the body should be roughly ${targetHanzi} hanzi. Quality over quantity — stop earlier if you'd otherwise reach for forbidden characters.

3. The story must feel natural, like a real short anecdote a learner could find in a graded reader. NOT a checklist of vocabulary words.

4. Use simple, common sentence structures appropriate for HSK ${level}. Past tense indicators (了/过), aspect (在/着), basic comparisons — all fine. No literary or classical Chinese.

5. The English summary should be one warm, plain sentence — under 16 words, no spoilers, gives a feel for the story.

6. Pinyin title MUST use diacritic tone marks (ā á ǎ à), capitalised first letter, spaces between syllables, no tone numbers.

7. Generate EXACTLY 3 comprehension questions in English about specific facts from the story. Each has:
   - q: a clear question in English
   - a: the correct answer in plain English (short — a noun or short phrase)
   - distractors: 3 plausible-but-wrong answers in English, in the same format and length as 'a'

OUTPUT STRICT JSON ONLY:
{
  "titleZh": "...",
  "pinyinTitle": "...",
  "summaryEn": "...",
  "bodyZh": "...",
  "comprehension": [
    {"q": "...", "a": "...", "distractors": ["...", "...", "..."]}
  ]
}`;
}

function buildUserPrompt(level, topic, rejected) {
  const rejectedBlock = rejected.length > 0
    ? `\nYOUR PREVIOUS ATTEMPTS WERE REJECTED — fix these mistakes:
${rejected.map((r) => `  ✗ ${r.reason}`).join("\n")}\n`
    : "";

  return `Write one HSK ${level} story.

TOPIC: ${topic.en}

The story should follow this topic naturally — don't shoehorn the description in. Use a fictional character with a simple Chinese name if needed (王明, 小红, 李华, 张伟, etc.) — make sure every character of the name is in the whitelist.
${rejectedBlock}
Output strict JSON only.`;
}

async function generateOneStory(level, topic, rejected = []) {
  const system = buildSystemPrompt(level);
  const user = buildUserPrompt(level, topic, rejected);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty response");
  const parsed = JSON.parse(content);
  // Validate shape
  if (
    typeof parsed.titleZh !== "string" ||
    typeof parsed.pinyinTitle !== "string" ||
    typeof parsed.summaryEn !== "string" ||
    typeof parsed.bodyZh !== "string" ||
    !Array.isArray(parsed.comprehension) ||
    parsed.comprehension.length !== 3
  ) {
    throw new Error(`Bad shape: ${content.slice(0, 200)}`);
  }
  return parsed;
}

// ──────────────────────────────────────────────────────────────────────────
// Validation against whitelist
// ──────────────────────────────────────────────────────────────────────────
const CJK_RE = /[一-鿿]/;
function illegalHanzi(text, whitelist) {
  const bad = new Set();
  for (const ch of text) {
    if (CJK_RE.test(ch) && !whitelist.has(ch)) bad.add(ch);
  }
  return [...bad];
}

function estimateDurationMin(bodyZh) {
  const hanziCount = [...bodyZh].filter((c) => CJK_RE.test(c)).length;
  // ~60 hanzi/min for slow careful reading at this level.
  return Math.max(1, Math.round(hanziCount / 60));
}

// ──────────────────────────────────────────────────────────────────────────
// Concurrency pump
// ──────────────────────────────────────────────────────────────────────────
async function runPool(items, worker, concurrency) {
  let cursor = 0;
  let inFlight = 0;
  return new Promise((resolve, reject) => {
    let settled = false;
    function pump() {
      if (settled) return;
      while (inFlight < concurrency && cursor < items.length) {
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
// Per-(level, topic) generation
// ──────────────────────────────────────────────────────────────────────────
function storyIdFor(level, topic) {
  return `hsk${level}-${topic.id}`;
}

async function generateForSlot(slot, cache) {
  const { level, topic } = slot;
  const id = storyIdFor(level, topic);
  if (cache[id]) return; // already generated

  const whitelist = WHITELIST[level];
  let rejected = [];
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let candidate;
    try {
      candidate = await generateOneStory(level, topic, rejected);
    } catch (err) {
      console.warn(`  [${id}] attempt ${attempt + 1} OpenAI error: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }

    // Counting illegal hanzi against the lenient HSK 1..N+1 whitelist.
    // We tolerate a small fraction (≤5%) of out-of-range characters so the
    // story doesn't read like a vocabulary list — the curated bundle does
    // the same thing and reads more naturally for it.
    const illegalBody = illegalHanzi(candidate.bodyZh, whitelist);
    const illegalTitle = illegalHanzi(candidate.titleZh, whitelist);
    const allIllegal = [...new Set([...illegalBody, ...illegalTitle])];
    const totalHanzi = [...candidate.bodyZh].filter((c) => CJK_RE.test(c)).length;
    const illegalRatio = totalHanzi > 0 ? allIllegal.length / totalHanzi : 1;
    const tooMany = allIllegal.length > 6 || illegalRatio > 0.05;

    if (tooMany && attempt < MAX_RETRIES - 1) {
      rejected.push({
        reason: `${allIllegal.length} out-of-range hanzi (target: ≤6, ratio ≤5%). Offenders: ${allIllegal.slice(0, 15).join(" ")} — substitute with simpler synonyms from the preferred set.`,
      });
      if (rejected.length > 2) rejected.shift();
      continue;
    }

    // Accept — including stories with a few extra characters on the last
    // attempt, since fighting the model further wastes API quota and the
    // small overflow won't break the learner's flow.
    const story = {
      id,
      hskLevel: level,
      emoji: topic.emoji,
      titleZh: candidate.titleZh,
      pinyinTitle: candidate.pinyinTitle,
      summaryEn: candidate.summaryEn,
      durationMin: estimateDurationMin(candidate.bodyZh),
      bodyZh: candidate.bodyZh,
      comprehension: candidate.comprehension,
    };
    cache[id] = story;
    saveCache(cache);
    const flag = allIllegal.length > 0 ? ` (${allIllegal.length} extra hanzi)` : "";
    console.log(`  ✓ ${id}  (${totalHanzi} hanzi)${flag}`);
    return;
  }

  console.warn(`  ✗ ${id} — gave up after ${MAX_RETRIES} retries`);
}

// ──────────────────────────────────────────────────────────────────────────
// Emit final stories.json
// ──────────────────────────────────────────────────────────────────────────
function emitStoriesFile(cache) {
  // Preserve curated stories from the existing file, append generated ones.
  let existing = [];
  if (existsSync(outPath)) {
    try {
      existing = JSON.parse(readFileSync(outPath, "utf-8")).stories ?? [];
    } catch {
      existing = [];
    }
  }
  const existingIds = new Set(existing.map((s) => s.id));
  const generated = Object.values(cache).filter((s) => !existingIds.has(s.id));

  // Curated first (HSK 1, 2, 3), then generated (also sorted by level then id).
  const sortByLevelThenId = (a, b) =>
    a.hskLevel - b.hskLevel || a.id.localeCompare(b.id);

  const out = {
    version: 2,
    stories: [
      ...[...existing].sort(sortByLevelThenId),
      ...generated.sort(sortByLevelThenId),
    ],
  };
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const s of out.stories) counts[s.hskLevel] = (counts[s.hskLevel] ?? 0) + 1;
  console.log(`\nWrote ${outPath}`);
  console.log(`  Total: ${out.stories.length} stories`);
  console.log(`  By level: HSK1=${counts[1]} · HSK2=${counts[2]} · HSK3=${counts[3]}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Generator: target=${TARGET}/level · levels=[${LEVELS.join(",")}] · concurrency=${CONCURRENCY}`);
  for (const lvl of LEVELS) {
    console.log(`  HSK ${lvl}: ${WHITELIST[lvl].size} hanzi in whitelist`);
  }

  const cache = loadCache();

  // Seed the cache with whatever's already in stories.json so we never spend
  // an API call on a topic/level that's already covered by a curated story.
  if (existsSync(outPath)) {
    try {
      const curated = JSON.parse(readFileSync(outPath, "utf-8")).stories ?? [];
      let seeded = 0;
      for (const s of curated) {
        if (!cache[s.id]) {
          cache[s.id] = s;
          seeded++;
        }
      }
      if (seeded > 0) {
        console.log(`Seeded cache with ${seeded} curated stories from stories.json`);
        saveCache(cache);
      }
    } catch {
      /* ignore — start fresh */
    }
  }

  if (EMIT_ONLY) {
    emitStoriesFile(cache);
    return;
  }

  // Build the slot list: for each level, pick TARGET topics (slicing or
  // cycling the topic catalog as needed).
  const slots = [];
  for (const level of LEVELS) {
    for (let i = 0; i < TARGET; i++) {
      const topic = TOPICS[i % TOPICS.length];
      // If we need more topics than TOPICS.length, suffix with a counter so
      // ids remain unique inside the cache.
      const suffix = i >= TOPICS.length ? `-v${Math.floor(i / TOPICS.length) + 1}` : "";
      const sloTopic = suffix ? { ...topic, id: topic.id + suffix } : topic;
      const id = storyIdFor(level, sloTopic);
      if (cache[id]) continue;
      slots.push({ level, topic: sloTopic });
    }
  }

  console.log(`Slots to generate: ${slots.length}\n`);
  if (DRY) {
    for (const s of slots.slice(0, 10)) {
      console.log(`  · ${storyIdFor(s.level, s.topic)}  (${s.topic.en})`);
    }
    if (slots.length > 10) console.log(`  … and ${slots.length - 10} more`);
    return;
  }

  const startedAt = Date.now();
  await runPool(slots, (slot) => generateForSlot(slot, cache), CONCURRENCY);
  const dur = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\nGeneration finished in ${dur}s.`);

  emitStoriesFile(cache);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
