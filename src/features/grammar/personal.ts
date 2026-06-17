import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { create } from "zustand";

import { logger } from "@/lib/logger";

import type { PatternPhrase } from "./patterns";

const STORAGE_KEY = "@mandarinai/grammar-personal-deck:v1";

/**
 * A construction the user added themselves. Mirrors the shape of the shipped
 * `Construction` so the same trainer screen can render either source.
 *
 * The `id` here is a string (UUID-ish) rather than the integer ids used by
 * the curated bundles — keeps the two id spaces from colliding when the
 * trainer routes by id.
 */
export type PersonalConstruction = {
  id: string;
  name: string;
  ru_name: string;
  pattern: string;
  patterns: PatternPhrase[];
  createdAt: string;
  updatedAt: string;
};

export type ParsedImport = {
  constructions: Array<{
    name: string;
    ru_name: string;
    pattern: string;
    patterns: PatternPhrase[];
  }>;
};

// ──────────────────────────────────────────────────────────────────────────
// Import parsing
// ──────────────────────────────────────────────────────────────────────────

/**
 * Accepts a few permissive shapes so users don't have to remember the exact
 * convention:
 *
 *   { constructions: [{ name, ru_name, pattern, patterns: [...] }] }
 *   { constructions: [{ name, ru_name, pattern, phrases: [...] }] }
 *   { name, ru_name, pattern, patterns: [...] }    // single construction
 *   [{ name, ru_name, pattern, patterns: [...] }]  // bare array
 *
 * Phrase objects must contain at minimum `zh` and either `ru` or `en`. `py`
 * is optional — the trainer will fall back to pinyin-pro if missing.
 */
export function parseImport(raw: string): { ok: true; data: ParsedImport } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `Невалидный JSON: ${(err as Error).message}` };
  }

  let arr: unknown;
  if (Array.isArray(json)) {
    arr = json;
  } else if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.constructions)) {
      arr = obj.constructions;
    } else if (typeof obj.name === "string" && (Array.isArray(obj.patterns) || Array.isArray(obj.phrases))) {
      // Single construction wrapped at top level — treat as a one-element list.
      arr = [obj];
    } else {
      return { ok: false, error: "Ожидается объект с полем 'constructions' или одна конструкция" };
    }
  } else {
    return { ok: false, error: "Ожидается JSON-объект или массив" };
  }

  if (!Array.isArray(arr) || arr.length === 0) {
    return { ok: false, error: "Список конструкций пуст" };
  }

  const out: ParsedImport["constructions"] = [];
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    if (!c || typeof c !== "object") {
      return { ok: false, error: `Конструкция #${i + 1}: ожидается объект` };
    }
    const obj = c as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const ru_name = typeof obj.ru_name === "string" ? obj.ru_name.trim() : "";
    const pattern = typeof obj.pattern === "string" ? obj.pattern.trim() : "";
    if (!name) return { ok: false, error: `Конструкция #${i + 1}: отсутствует name` };

    const phrasesRaw = (obj.patterns ?? obj.phrases) as unknown;
    if (!Array.isArray(phrasesRaw)) {
      return { ok: false, error: `Конструкция «${name}»: нужно поле patterns или phrases (массив)` };
    }
    const phrases: PatternPhrase[] = [];
    for (let j = 0; j < phrasesRaw.length; j++) {
      const p = phrasesRaw[j];
      if (!p || typeof p !== "object") {
        return { ok: false, error: `«${name}» фраза #${j + 1}: ожидается объект` };
      }
      const pe = p as Record<string, unknown>;
      const zh = typeof pe.zh === "string" ? pe.zh.trim() : "";
      const ru = typeof pe.ru === "string" ? pe.ru.trim() : "";
      const py = typeof pe.py === "string" ? pe.py.trim() : "";
      if (!zh) return { ok: false, error: `«${name}» фраза #${j + 1}: отсутствует zh` };
      if (!ru && !pe.en) {
        return { ok: false, error: `«${name}» фраза #${j + 1}: нужен перевод (поле ru или en)` };
      }

      const phrase: PatternPhrase = { zh, py, ru };
      // Pass through any other language fields verbatim.
      for (const k of ["en", "de", "es", "pt", "pl", "uk"] as const) {
        const v = pe[k];
        if (typeof v === "string" && v.trim()) phrase[k] = v.trim();
      }
      phrases.push(phrase);
    }

    out.push({ name, ru_name, pattern, patterns: phrases });
  }

  return { ok: true, data: { constructions: out } };
}

// ──────────────────────────────────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────────────────────────────────

/**
 * Serialize the user's personal deck to a JSON string. The shape mirrors what
 * `parseImport` accepts so the export round-trips cleanly through import on
 * another device. Drops bookkeeping fields (id / createdAt / updatedAt) since
 * they're regenerated on import.
 */
export function exportToJson(constructions: PersonalConstruction[]): string {
  const payload = {
    constructions: constructions.map((c) => ({
      name: c.name,
      ru_name: c.ru_name,
      pattern: c.pattern,
      patterns: c.patterns.map((p) => {
        const out: PatternPhrase = { zh: p.zh, py: p.py ?? "", ru: p.ru };
        for (const k of ["en", "de", "es", "pt", "pl", "uk"] as const) {
          const v = p[k];
          if (typeof v === "string" && v.trim()) out[k] = v;
        }
        return out;
      }),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// ──────────────────────────────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────────────────────────────

type StoreState = {
  hydrated: boolean;
  constructions: PersonalConstruction[];
  hydrate: () => Promise<void>;

  /** Create a new construction; returns its id. */
  createConstruction: (input: {
    name: string;
    ru_name: string;
    pattern: string;
  }) => string;

  /** Edit metadata. Phrase list is left untouched. */
  updateConstruction: (
    id: string,
    patch: Partial<Pick<PersonalConstruction, "name" | "ru_name" | "pattern">>,
  ) => void;

  removeConstruction: (id: string) => void;

  addPhrase: (constructionId: string, phrase: PatternPhrase) => void;
  removePhrase: (constructionId: string, phraseIndex: number) => void;
  updatePhrase: (
    constructionId: string,
    phraseIndex: number,
    patch: Partial<PatternPhrase>,
  ) => void;

  /** Bulk import. Returns counts so the importer screen can summarise. */
  importBundle: (bundle: ParsedImport) => {
    addedConstructions: number;
    addedPhrases: number;
  };

  getConstruction: (id: string) => PersonalConstruction | null;
};

function persist(state: { constructions: PersonalConstruction[] }) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((err) =>
    logger.warn("personal deck persist error", err),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const usePersonalDeck = create<StoreState>((set, get) => ({
  hydrated: false,
  constructions: [],

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { constructions?: unknown };
        if (Array.isArray(parsed.constructions)) {
          set({
            constructions: parsed.constructions as PersonalConstruction[],
            hydrated: true,
          });
          return;
        }
      }
    } catch (err) {
      logger.warn("personal deck hydrate error", err);
    }
    set({ hydrated: true });
  },

  createConstruction: ({ name, ru_name, pattern }) => {
    const id = genId();
    const c: PersonalConstruction = {
      id,
      name: name.trim(),
      ru_name: ru_name.trim(),
      pattern: pattern.trim(),
      patterns: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const next = [...get().constructions, c];
    set({ constructions: next });
    persist({ constructions: next });
    return id;
  },

  updateConstruction: (id, patch) => {
    const next = get().constructions.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c,
    );
    set({ constructions: next });
    persist({ constructions: next });
  },

  removeConstruction: (id) => {
    const next = get().constructions.filter((c) => c.id !== id);
    set({ constructions: next });
    persist({ constructions: next });
  },

  addPhrase: (constructionId, phrase) => {
    const next = get().constructions.map((c) =>
      c.id === constructionId
        ? { ...c, patterns: [...c.patterns, phrase], updatedAt: nowIso() }
        : c,
    );
    set({ constructions: next });
    persist({ constructions: next });
  },

  removePhrase: (constructionId, phraseIndex) => {
    const next = get().constructions.map((c) =>
      c.id === constructionId
        ? {
            ...c,
            patterns: c.patterns.filter((_, i) => i !== phraseIndex),
            updatedAt: nowIso(),
          }
        : c,
    );
    set({ constructions: next });
    persist({ constructions: next });
  },

  updatePhrase: (constructionId, phraseIndex, patch) => {
    const next = get().constructions.map((c) =>
      c.id === constructionId
        ? {
            ...c,
            patterns: c.patterns.map((p, i) =>
              i === phraseIndex ? { ...p, ...patch } : p,
            ),
            updatedAt: nowIso(),
          }
        : c,
    );
    set({ constructions: next });
    persist({ constructions: next });
  },

  importBundle: (bundle) => {
    let addedConstructions = 0;
    let addedPhrases = 0;
    const additions: PersonalConstruction[] = [];

    const existing = get().constructions;
    const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

    const next = [...existing];

    for (const incoming of bundle.constructions) {
      const dupe = byName.get(incoming.name.toLowerCase());
      if (dupe) {
        // Merge phrases by zh; skip duplicates within the existing construction.
        const seen = new Set(dupe.patterns.map((p) => p.zh));
        const fresh = incoming.patterns.filter((p) => !seen.has(p.zh));
        if (fresh.length === 0) continue;
        addedPhrases += fresh.length;
        const idx = next.findIndex((c) => c.id === dupe.id);
        next[idx] = {
          ...dupe,
          patterns: [...dupe.patterns, ...fresh],
          updatedAt: nowIso(),
        };
      } else {
        const c: PersonalConstruction = {
          id: genId(),
          name: incoming.name,
          ru_name: incoming.ru_name,
          pattern: incoming.pattern,
          patterns: [...incoming.patterns],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        additions.push(c);
        addedConstructions += 1;
        addedPhrases += c.patterns.length;
      }
    }

    const merged = [...next, ...additions];
    set({ constructions: merged });
    persist({ constructions: merged });
    return { addedConstructions, addedPhrases };
  },

  getConstruction: (id) => get().constructions.find((c) => c.id === id) ?? null,
}));

/** Auto-hydrate hook for screens that read the deck. */
export function useHydratedPersonalDeck() {
  const store = usePersonalDeck();
  useEffect(() => {
    if (!store.hydrated) {
      void store.hydrate();
    }
  }, [store.hydrated, store]);
  return store;
}
