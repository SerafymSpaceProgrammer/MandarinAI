import { chatCompletion } from "../lib/openai";
import { toPinyin } from "../lib/pinyin";
import type { TranscriptLine, VocabItem } from "../types";

export async function extractVocab(
  transcript: TranscriptLine[],
  hskLevel: number,
  existingHanzi: Set<string>
): Promise<Omit<VocabItem, "id" | "user_id" | "source_conversation_id" | "created_at">[]> {
  const text = transcript
    .filter((l) => l.role === "assistant")
    .map((l) => l.hanzi)
    .join("\n");

  if (!text.trim()) return [];

  const prompt = `You are a Mandarin vocabulary extractor. Given this Chinese text from an HSK ${hskLevel} conversation, extract 3-7 useful vocabulary words or short phrases for a learner at that level.

Text:
${text}

Return ONLY a JSON array with no markdown, like:
[{"hanzi":"你好","english":"hello"},{"hanzi":"咖啡","english":"coffee"}]

Only include words not in this existing set: ${JSON.stringify([...existingHanzi])}
Prefer words that are: common, learnable, and appeared in context.`;

  const raw = await chatCompletion([{ role: "user", content: prompt }]);

  let parsed: { hanzi: string; english: string }[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]) as { hanzi: string; english: string }[];
  } catch {
    return [];
  }

  const now = new Date().toISOString();
  return parsed
    .filter((w) => w.hanzi && w.english && !existingHanzi.has(w.hanzi))
    .map((w) => ({
      hanzi: w.hanzi,
      pinyin: toPinyin(w.hanzi),
      english: w.english,
      srs_interval_days: 1,
      next_review_at: now,
      ease_factor: 2.5,
    }));
}
