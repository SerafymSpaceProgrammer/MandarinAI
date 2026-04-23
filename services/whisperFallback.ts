/**
 * Fallback: record audio in chunks → Whisper STT → GPT-4o-mini → TTS.
 * Used when WebRTC (Realtime API) is unavailable in Expo Go.
 */
import { Audio } from "expo-av";
import { chatCompletion, OPENAI_API_KEY, OPENAI_BASE_URL } from "../lib/openai";
import type { Scenario, HskLevel } from "../types";

export interface FallbackCallbacks {
  onUserTranscript: (text: string) => void;
  onAssistantText: (text: string) => void;
  onAssistantAudio: (uri: string) => void;
  onError: (err: Error) => void;
}

export interface FallbackSession {
  startTurn: () => Promise<void>;
  endTurn: () => Promise<void>;
  stop: () => void;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function createFallbackSession(
  scenario: Scenario,
  hskLevel: HskLevel,
  callbacks: FallbackCallbacks
): FallbackSession {
  const history: ChatMessage[] = [
    {
      role: "system",
      content: `You are a native Mandarin Chinese speaker playing the role of ${scenario.system_prompt}
Speak ONLY in Mandarin Chinese.
Adapt your vocabulary and grammar to HSK level ${hskLevel}.
Keep responses short (1-2 sentences).`,
    },
    { role: "assistant", content: scenario.starter_line_zh },
  ];

  let recording: Audio.Recording | null = null;
  let stopped = false;

  const startTurn = async () => {
    if (stopped) return;
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
  };

  const endTurn = async () => {
    if (!recording || stopped) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    if (!uri) return;

    // Whisper STT
    const formData = new FormData();
    formData.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as unknown as Blob);
    formData.append("model", "whisper-1");

    const sttRes = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });
    const sttData = await sttRes.json() as { text: string };
    const userText = sttData.text;
    callbacks.onUserTranscript(userText);
    history.push({ role: "user", content: userText });

    // GPT-4o-mini response
    const reply = await chatCompletion(history);
    callbacks.onAssistantText(reply);
    history.push({ role: "assistant", content: reply });

    // TTS
    const ttsRes = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "tts-1", input: reply, voice: "shimmer" }),
    });

    if (ttsRes.ok) {
      // Save audio blob and play — simplified for MVP
      callbacks.onAssistantAudio("");
    }
  };

  const stop = () => {
    stopped = true;
    recording?.stopAndUnloadAsync().catch(() => undefined);
  };

  return { startTurn, endTurn, stop };
}
