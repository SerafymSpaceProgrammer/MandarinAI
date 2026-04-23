export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Scenario {
  id: string;
  title_en: string;
  title_zh: string;
  system_prompt: string;
  starter_line_zh: string;
}

export interface TranscriptLine {
  role: "user" | "assistant";
  hanzi: string;
  pinyin: string;
  english: string;
  timestamp: number;
}

export interface VocabItem {
  id?: string;
  user_id?: string;
  hanzi: string;
  pinyin: string;
  english: string;
  source_conversation_id?: string;
  srs_interval_days: number;
  next_review_at: string;
  ease_factor: number;
  created_at?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  scenario: string;
  hsk_level: HskLevel;
  duration_seconds: number;
  transcript: TranscriptLine[];
  created_at: string;
}

export interface Profile {
  id: string;
  hsk_level: HskLevel;
  native_language: string;
  created_at: string;
}

export interface SessionSummary {
  conversation: Conversation;
  newVocab: VocabItem[];
}
