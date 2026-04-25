// Reads CC-CEDICT (community Chinese↔English dictionary, ~115k entries)
// from the ChineseLens extension's bundled copy and builds two artefacts:
//
//   1. scripts/cedict-translations.json
//      [{hanzi, lang: 'en', meanings: [...], source: 'curated'}, ...]
//      ← high-quality hand-curated English; replaces Google's autotranslate.
//
//   2. scripts/cedict-pos.json
//      [{hanzi, pos: ['verb', 'noun', ...]}, ...]
//      ← POS tags inferred from definition shape. Not perfect (no formal
//      tagger, just pragmatic regexes against CC-CEDICT's house style),
//      but good enough for a "Verbs only" filter on the catalog.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const CEDICT_PATH = join(repoRoot, "..", "ChineseLens", "scripts", "data", "cedict.txt");
const HSK_JSON_PATH = join(__dirname, "hsk-import.json");

const TRANSLATIONS_OUT = join(__dirname, "cedict-translations.json");
const POS_OUT = join(__dirname, "cedict-pos.json");

console.log("Reading CC-CEDICT…");
const cedictRaw = readFileSync(CEDICT_PATH, "utf-8");
const cedictLines = cedictRaw.split("\n").filter((l) => l && !l.startsWith("#"));
console.log(`  ${cedictLines.length} entries`);

// Map simplified-hanzi → list of definition arrays (one per CEDICT row).
// Multiple rows can share a simplified form when readings differ.
const cedictMap = new Map();

for (const line of cedictLines) {
  // Format: TRAD SIMP [pinyin] /def1/def2/def3/
  const m = line.match(/^(\S+)\s+(\S+)\s+\[[^\]]*\]\s+\/(.+)\/\s*$/);
  if (!m) continue;
  const [, , simp, defStr] = m;
  const defs = defStr.split("/").map((d) => d.trim()).filter((d) => d.length > 0);
  if (defs.length === 0) continue;
  if (!cedictMap.has(simp)) cedictMap.set(simp, []);
  cedictMap.get(simp).push(defs);
}
console.log(`  ${cedictMap.size} distinct simplified entries`);

// ──────────────────────────────────────────────────────────────────────
// POS inference rules — applied across ALL definitions of a word so we
// can capture multi-POS cases (e.g. 教 is both verb and noun).
// ──────────────────────────────────────────────────────────────────────
function inferPos(allDefs) {
  const tags = new Set();
  for (const d of allDefs) {
    const lower = d.toLowerCase();

    // Verbs — defining shape "to ..."
    if (/^to\s+\w/.test(lower)) tags.add("verb");

    // Adjectives
    if (/\b\(adj\.?\)|\badj\b|\badjective\b/.test(lower)) tags.add("adjective");
    if (/^\w+\s+(?:and|or)\s+\w+$/.test(lower) && /(?:happy|sad|big|small|good|bad|new|old|hot|cold|fast|slow|easy|hard)/.test(lower))
      tags.add("adjective");

    // Adverbs
    if (/\b\(adv\.?\)|\badverb\b/.test(lower)) tags.add("adverb");

    // Classifiers / measure words — CEDICT marks these very consistently.
    if (/\bclassifier for\b|\bmeasure word\b|\bclassifier:/.test(lower)) tags.add("classifier");

    // Particles
    if (/\bparticle\b|\bgrammatical\b|\bsentence-final\b/.test(lower)) tags.add("particle");

    // Pronouns
    if (/\bpronoun\b|\bpron\.?\b/.test(lower)) tags.add("pronoun");

    // Conjunctions
    if (/\bconjunction\b|\bconj\.?\b/.test(lower)) tags.add("conjunction");

    // Interjections
    if (/\binterjection\b|\binterj\.?\b/.test(lower)) tags.add("interjection");

    // Prepositions
    if (/\bpreposition\b|\bprep\.?\b/.test(lower)) tags.add("preposition");

    // Numbers
    if (/\bnumber\b|\bnumeral\b/.test(lower)) tags.add("number");
    if (/^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|first|second|third|fourth|fifth|tenth)$/.test(lower))
      tags.add("number");

    // Proper nouns: surnames, place names, named entities.
    if (/\bsurname\b|\b\(name\b|\bplace name\b|\babbr\. for\b/.test(lower))
      tags.add("proper");
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s/.test(d) && /province|city|county/i.test(d))
      tags.add("proper");
  }

  // Default to noun if nothing matched and the entry doesn't look verb-y.
  if (tags.size === 0) tags.add("noun");

  return [...tags].sort();
}

// ──────────────────────────────────────────────────────────────────────
// Walk the HSK list
// ──────────────────────────────────────────────────────────────────────
const hsk = JSON.parse(readFileSync(HSK_JSON_PATH, "utf-8"));
console.log(`Reading ${hsk.length} HSK words…`);

const translations = [];
const posRows = [];
let hits = 0;
let misses = 0;
const missList = [];

for (const w of hsk) {
  const entries = cedictMap.get(w.hanzi);
  if (!entries) {
    misses += 1;
    if (missList.length < 25) missList.push(w.hanzi);
    continue;
  }
  hits += 1;

  // Combine all definitions across readings, dedupe, cap at 6.
  const allDefs = [];
  const seen = new Set();
  for (const defs of entries) {
    for (const d of defs) {
      // Strip CEDICT cross-references like "see 你好[ni3 hao3]".
      const cleaned = d.replace(/\s*\[[^\]]+\]/g, "").trim();
      if (!cleaned) continue;
      if (seen.has(cleaned.toLowerCase())) continue;
      seen.add(cleaned.toLowerCase());
      allDefs.push(cleaned);
    }
  }

  if (allDefs.length === 0) {
    misses += 1;
    continue;
  }

  translations.push({
    hanzi: w.hanzi,
    lang: "en",
    meanings: allDefs.slice(0, 6),
    source: "curated",
  });

  posRows.push({
    hanzi: w.hanzi,
    pos: inferPos(allDefs),
  });
}

console.log(`Coverage: ${hits} / ${hsk.length} (${Math.round((hits / hsk.length) * 100)}%)`);
console.log(`Misses (first 25): ${missList.join(", ")}`);

writeFileSync(TRANSLATIONS_OUT, JSON.stringify(translations));
writeFileSync(POS_OUT, JSON.stringify(posRows));
console.log(`\nWrote ${translations.length} translations → ${TRANSLATIONS_OUT}`);
console.log(`Wrote ${posRows.length} POS rows → ${POS_OUT}`);

// POS distribution sanity check
const posDist = new Map();
for (const r of posRows) {
  for (const p of r.pos) posDist.set(p, (posDist.get(p) ?? 0) + 1);
}
console.log("\nPOS distribution:");
for (const [p, c] of [...posDist].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${p.padEnd(14)} ${c}`);
}
