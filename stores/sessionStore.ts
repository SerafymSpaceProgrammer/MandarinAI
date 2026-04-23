import { create } from "zustand";
import type { TranscriptLine, Scenario, SessionSummary } from "../types";
import type { HskLevel } from "../types";

type SessionStatus = "idle" | "connecting" | "active" | "ending" | "done";

interface SessionState {
  status: SessionStatus;
  scenario: Scenario | null;
  hskLevel: HskLevel;
  transcript: TranscriptLine[];
  startedAt: number | null;
  summary: SessionSummary | null;

  setScenario: (scenario: Scenario, level: HskLevel) => void;
  setStatus: (status: SessionStatus) => void;
  addTranscriptLine: (line: TranscriptLine) => void;
  updateLastLine: (patch: Partial<TranscriptLine>) => void;
  setSummary: (summary: SessionSummary) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as SessionStatus,
  scenario: null,
  hskLevel: 1 as HskLevel,
  transcript: [],
  startedAt: null,
  summary: null,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setScenario: (scenario, hskLevel) => set({ scenario, hskLevel }),

  setStatus: (status) =>
    set((s) => ({
      status,
      startedAt: status === "active" && !s.startedAt ? Date.now() : s.startedAt,
    })),

  addTranscriptLine: (line) =>
    set((s) => ({ transcript: [...s.transcript, line] })),

  updateLastLine: (patch) =>
    set((s) => {
      const transcript = [...s.transcript];
      const last = transcript[transcript.length - 1];
      if (last) transcript[transcript.length - 1] = { ...last, ...patch };
      return { transcript };
    }),

  setSummary: (summary) => set({ summary }),

  reset: () => set(initialState),
}));
