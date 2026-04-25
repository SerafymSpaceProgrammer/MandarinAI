// Mirror src/i18n/strings.en.ts → scripts/strings.en.json so the translator
// (which is plain Node ESM) can read it without a TypeScript loader.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const tsFile = readFileSync(join(repoRoot, "src", "i18n", "strings.en.ts"), "utf-8");

// Extract everything between `export const EN = {` and `} as const;`.
const m = tsFile.match(/export const EN = (\{[\s\S]+\}) as const;/);
if (!m) throw new Error("Couldn't locate EN literal in strings.en.ts");
const literal = m[1];

// Convert TS object literal → JSON. Approach: rewrite quotes, drop trailing
// commas, eval-via-Function to get the actual object (it's just data).
// eslint-disable-next-line no-new-func
const obj = new Function(`return (${literal});`)();

writeFileSync(join(__dirname, "strings.en.json"), JSON.stringify(obj));
console.log("Wrote scripts/strings.en.json");
