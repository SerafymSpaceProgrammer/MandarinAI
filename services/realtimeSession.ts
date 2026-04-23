/**
 * Wraps OpenAI Realtime API via WebRTC.
 *
 * React Native's WebRTC support is limited — if this fails in Expo Go,
 * the practice screen falls back to the Whisper+TTS chunked approach.
 * See services/whisperFallback.ts for the fallback implementation.
 */
import { getRealtimeEphemeralKey } from "../lib/openai";
import type { Scenario } from "../types";
import type { HskLevel } from "../types";

export interface RealtimeCallbacks {
  onTranscriptDelta: (role: "user" | "assistant", text: string) => void;
  onAudioDelta: (base64: string) => void;
  onSessionEnd: () => void;
  onError: (err: Error) => void;
}

export interface RealtimeSession {
  stop: () => void;
}

function buildSystemPrompt(scenario: Scenario, hskLevel: HskLevel): string {
  return `You are a native Mandarin Chinese speaker playing the role of ${scenario.system_prompt}
Speak ONLY in Mandarin Chinese.
Adapt your vocabulary and grammar to HSK level ${hskLevel}:
- HSK 1-2: use only 150-300 most common words, simple sentences
- HSK 3-4: conversational, common topics, moderate vocabulary
- HSK 5-6: natural native-level speech
Speak at a pace appropriate for a learner at this level.
If the user seems confused or stops responding for 5+ seconds, repeat yourself slower.
Keep responses short (1-2 sentences) so the learner has space to speak.
Start the conversation with: "${scenario.starter_line_zh}"`;
}

export async function startRealtimeSession(
  scenario: Scenario,
  hskLevel: HskLevel,
  callbacks: RealtimeCallbacks
): Promise<RealtimeSession> {
  // NOTE: RTCPeerConnection is not natively available in Expo Go.
  // This will throw — the practice screen catches it and uses the fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RTCPeerConnection = (global as any).RTCPeerConnection;
  if (!RTCPeerConnection) {
    throw new Error("WebRTC not available in this environment");
  }

  const ephemeralKey = await getRealtimeEphemeralKey();
  const systemPrompt = buildSystemPrompt(scenario, hskLevel);

  const pc = new RTCPeerConnection();

  // Audio playback track
  pc.ontrack = (e: { streams: MediaStream[] }) => {
    // In a full RN WebRTC setup you'd pipe e.streams[0] to an audio element
    void e;
  };

  // Data channel for events
  const dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: systemPrompt,
        voice: "shimmer",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: { type: "server_vad" },
      },
    };
    dc.send(JSON.stringify(sessionUpdate));
  };

  dc.onmessage = (e: { data: string }) => {
    try {
      const event = JSON.parse(e.data) as Record<string, unknown>;
      const type = event.type as string;

      if (type === "response.audio_transcript.delta") {
        callbacks.onTranscriptDelta("assistant", event.delta as string);
      } else if (type === "conversation.item.input_audio_transcription.delta") {
        callbacks.onTranscriptDelta("user", event.delta as string);
      } else if (type === "response.audio.delta") {
        callbacks.onAudioDelta(event.delta as string);
      } else if (type === "response.done" || type === "session.ended") {
        callbacks.onSessionEnd();
      }
    } catch {
      // ignore parse errors
    }
  };

  // Create SDP offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(
    "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    }
  );

  if (!sdpRes.ok) {
    const err = await sdpRes.text();
    throw new Error(`SDP exchange failed: ${err}`);
  }

  const answerSdp = await sdpRes.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return {
    stop: () => {
      dc.close();
      pc.close();
      callbacks.onSessionEnd();
    },
  };
}
