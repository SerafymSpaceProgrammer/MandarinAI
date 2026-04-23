import { ScrollView, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useSessionStore } from "../stores/sessionStore";
import { TranscriptBubble } from "../components/TranscriptBubble";

export default function SummaryScreen() {
  const router = useRouter();
  const { summary, reset } = useSessionStore();

  const handleDone = () => {
    reset();
    router.replace("/(tabs)");
  };

  if (!summary) {
    router.replace("/(tabs)");
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 pt-6 pb-4">
          <Text className="text-2xl font-bold text-gray-900">Session Summary</Text>
          <Text className="text-gray-500 mt-1">
            {Math.floor((summary.conversation.duration_seconds ?? 0) / 60)}m{" "}
            {(summary.conversation.duration_seconds ?? 0) % 60}s ·{" "}
            {summary.conversation.transcript?.length ?? 0} exchanges
          </Text>
        </View>

        {/* Transcript */}
        <View className="px-5 mb-6">
          <Text className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Transcript
          </Text>
          {(summary.conversation.transcript ?? []).map((line, i) => (
            <TranscriptBubble key={i} line={line} showTranslation />
          ))}
        </View>

        {/* Vocab */}
        {summary.newVocab.length > 0 && (
          <View className="px-5">
            <Text className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
              New Vocabulary ({summary.newVocab.length})
            </Text>
            {summary.newVocab.map((v, i) => (
              <View
                key={i}
                className="bg-gray-50 rounded-2xl px-5 py-4 mb-2 flex-row items-center"
              >
                <View className="flex-1">
                  <Text className="text-xl font-medium text-gray-900">
                    {v.hanzi}
                  </Text>
                  <Text className="text-gray-500 text-sm">{v.pinyin}</Text>
                </View>
                <Text className="text-gray-700">{v.english}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="px-5 pb-6">
        <TouchableOpacity
          className="bg-accent rounded-2xl py-4 items-center"
          onPress={handleDone}
        >
          <Text className="text-white font-semibold text-base">Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
