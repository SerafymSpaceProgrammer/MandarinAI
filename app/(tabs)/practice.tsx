import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { MicButton } from "../../components/MicButton";
import { TranscriptBubble } from "../../components/TranscriptBubble";
import { useSessionStore } from "../../stores/sessionStore";
import { useUserStore } from "../../stores/userStore";
import { chatCompletion } from "../../lib/openai";
import { toPinyin } from "../../lib/pinyin";
import { extractVocab } from "../../services/vocabExtractor";
import { supabase } from "../../lib/supabase";
import { createFallbackSession } from "../../services/whisperFallback";
import type { TranscriptLine } from "../../types";
import type { FallbackSession } from "../../services/whisperFallback";
import scenarios from "../../assets/scenarios.json";
import type { Scenario } from "../../types";

export default function PracticeScreen() {
  const { scenario: scenarioId } = useLocalSearchParams<{ scenario: string }>();
  const router = useRouter();
  const { user, profile } = useUserStore();
  const {
    status,
    transcript,
    setScenario,
    setStatus,
    addTranscriptLine,
    updateLastLine,
    setSummary,
    reset,
  } = useSessionStore();

  const fallbackRef = useRef<FallbackSession | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const startedAt = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenario = (scenarios as Scenario[]).find((s) => s.id === scenarioId);
  const hskLevel = (profile?.hsk_level ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;

  useEffect(() => {
    if (scenario) setScenario(scenario, hskLevel);
    return () => {
      reset();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const startSession = async () => {
    if (!scenario) return;
    setStatus("connecting");

    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Add AI starter line to transcript
    const starterLine: TranscriptLine = {
      role: "assistant",
      hanzi: scenario.starter_line_zh,
      pinyin: toPinyin(scenario.starter_line_zh),
      english: "",
      timestamp: Date.now(),
    };
    addTranscriptLine(starterLine);

    // Use whisper+GPT fallback (Realtime WebRTC not available in Expo Go)
    const session = createFallbackSession(
      scenario,
      hskLevel,
      {
        onUserTranscript: (text) => {
          addTranscriptLine({
            role: "user",
            hanzi: text,
            pinyin: "",
            english: "",
            timestamp: Date.now(),
          });
        },
        onAssistantText: (text) => {
          addTranscriptLine({
            role: "assistant",
            hanzi: text,
            pinyin: toPinyin(text),
            english: "",
            timestamp: Date.now(),
          });
        },
        onAssistantAudio: () => undefined,
        onError: (err) => {
          Alert.alert("Error", err.message);
          setStatus("idle");
        },
      }
    );

    fallbackRef.current = session;
    startedAt.current = Date.now();
    setStatus("active");

    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);

    // Start first turn
    await session.startTurn();
  };

  const handleMicPress = async () => {
    if (status === "idle") {
      await startSession();
    } else if (status === "active") {
      // End current recording turn
      await fallbackRef.current?.endTurn();
      // Start new turn
      await fallbackRef.current?.startTurn();
    }
  };

  const handleEnd = async () => {
    if (!scenario || !user) return;
    if (timerRef.current) clearInterval(timerRef.current);

    fallbackRef.current?.stop();
    setStatus("ending");

    const duration = Math.floor((Date.now() - startedAt.current) / 1000);

    // Enrich transcript with translations via GPT-4o-mini
    const enriched = await enrichTranscript(transcript);

    // Extract vocab
    const { data: existingVocab } = await supabase
      .from("vocab")
      .select("hanzi")
      .eq("user_id", user.id);
    const existingHanzi = new Set((existingVocab ?? []).map((v: { hanzi: string }) => v.hanzi));

    const newVocab = await extractVocab(enriched, hskLevel, existingHanzi);

    // Save conversation
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        scenario: scenario.id,
        hsk_level: hskLevel,
        duration_seconds: duration,
        transcript: enriched,
      })
      .select()
      .single();

    // Save vocab
    if (newVocab.length > 0 && conv) {
      await supabase.from("vocab").insert(
        newVocab.map((v) => ({
          ...v,
          user_id: user.id,
          source_conversation_id: conv.id,
        }))
      );
    }

    setSummary({
      conversation: conv ?? {
        id: "",
        user_id: user.id,
        scenario: scenario.id,
        hsk_level: hskLevel,
        duration_seconds: duration,
        transcript: enriched,
        created_at: new Date().toISOString(),
      },
      newVocab: newVocab.map((v) => ({ ...v, id: undefined, user_id: user.id })),
    });

    setStatus("done");
    router.push("/summary");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Text className="flex-1 text-lg font-semibold text-gray-800">
          {scenario?.title_en ?? "Practice"}
        </Text>
        {status === "active" && (
          <View className="flex-row items-center bg-red-50 px-3 py-1 rounded-full">
            <View className="w-2 h-2 rounded-full bg-accent mr-2" />
            <Text className="text-accent text-sm font-medium">
              {formatTime(elapsedSeconds)}
            </Text>
          </View>
        )}
      </View>

      {/* Transcript */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 12 }}
      >
        {transcript.length === 0 && status === "idle" && scenario && (
          <View className="items-center py-12">
            <Text className="text-4xl mb-3">🎙️</Text>
            <Text className="text-xl font-semibold text-gray-700 mb-1">
              {scenario.title_en}
            </Text>
            <Text className="text-gray-500 text-center px-8 mb-4">
              The AI will start by saying:
            </Text>
            <View className="bg-gray-50 rounded-2xl px-5 py-4">
              <Text className="text-xl text-gray-800 text-center">
                {scenario.starter_line_zh}
              </Text>
            </View>
            <Text className="text-gray-400 text-sm mt-6">
              Tap the mic to start
            </Text>
          </View>
        )}

        {transcript.map((line, i) => (
          <TranscriptBubble key={i} line={line} />
        ))}

        {status === "connecting" && (
          <View className="items-center py-4">
            <ActivityIndicator color="#E63946" />
            <Text className="text-gray-400 mt-2 text-sm">Connecting…</Text>
          </View>
        )}
        {status === "ending" && (
          <View className="items-center py-4">
            <ActivityIndicator color="#E63946" />
            <Text className="text-gray-400 mt-2 text-sm">
              Processing session…
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Controls */}
      <View className="pb-8 pt-4 items-center">
        {status !== "ending" && status !== "done" && (
          <>
            <MicButton
              isActive={status === "active"}
              isLoading={status === "connecting"}
              onPress={handleMicPress}
            />
            {status === "active" && (
              <Text
                className="mt-4 text-accent text-sm font-medium underline"
                onPress={handleEnd}
              >
                End session
              </Text>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

async function enrichTranscript(transcript: TranscriptLine[]): Promise<TranscriptLine[]> {
  if (transcript.length === 0) return transcript;

  const assistantLines = transcript
    .filter((l) => l.role === "assistant")
    .map((l) => l.hanzi)
    .join("\n");

  if (!assistantLines.trim()) return transcript;

  const prompt = `Translate each of the following Mandarin sentences to English. Return ONLY a JSON array of strings in the same order, no markdown.

Sentences:
${assistantLines}`;

  const raw = await chatCompletion([{ role: "user", content: prompt }]);

  let translations: string[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) translations = JSON.parse(match[0]) as string[];
  } catch {
    return transcript;
  }

  let transIdx = 0;
  return transcript.map((line) => {
    if (line.role === "assistant") {
      const english = translations[transIdx++] ?? "";
      return { ...line, english };
    }
    return line;
  });
}
