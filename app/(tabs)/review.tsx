import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useUserStore } from "../../stores/userStore";
import type { VocabItem } from "../../types";

type ReviewCard = VocabItem & { id: string };

export default function ReviewScreen() {
  const { user } = useUserStore();
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadDueCards();
  }, [user]);

  const loadDueCards = async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("vocab")
      .select("*")
      .eq("user_id", user.id)
      .lte("next_review_at", now)
      .order("next_review_at")
      .limit(20);
    setCards((data as ReviewCard[]) ?? []);
    setIndex(0);
    setDone(false);
    setLoading(false);
  };

  const handleGrade = async (grade: "again" | "good" | "easy") => {
    const card = cards[index];
    if (!card) return;

    let { srs_interval_days, ease_factor } = card;

    if (grade === "again") {
      srs_interval_days = 1;
    } else if (grade === "good") {
      srs_interval_days = Math.round(srs_interval_days * ease_factor);
    } else {
      srs_interval_days = Math.round(srs_interval_days * ease_factor * 1.3);
      ease_factor = Math.min(ease_factor + 0.1, 3.5);
    }

    const next = new Date();
    next.setDate(next.getDate() + srs_interval_days);

    await supabase
      .from("vocab")
      .update({
        srs_interval_days,
        ease_factor,
        next_review_at: next.toISOString(),
      })
      .eq("id", card.id);

    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#E63946" />
      </SafeAreaView>
    );
  }

  if (done || cards.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-5xl mb-4">🎉</Text>
        <Text className="text-xl font-bold text-gray-800 mb-2">
          {cards.length === 0 ? "No cards due" : "Session complete!"}
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          {cards.length === 0
            ? "You're all caught up. Practice more to add vocab."
            : `You reviewed ${cards.length} card${cards.length !== 1 ? "s" : ""}.`}
        </Text>
        <TouchableOpacity
          className="bg-accent px-6 py-3 rounded-xl"
          onPress={loadDueCards}
        >
          <Text className="text-white font-semibold">Refresh</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const card = cards[index];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-6 pb-2 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-800">Flashcards</Text>
        <Text className="text-gray-400 text-sm">
          {index + 1} / {cards.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View className="mx-5 h-1.5 bg-gray-100 rounded-full mb-6">
        <View
          className="h-1.5 bg-accent rounded-full"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </View>

      {/* Card */}
      <TouchableOpacity
        className="mx-5 flex-1 bg-gray-50 rounded-3xl items-center justify-center p-8"
        onPress={() => setRevealed(true)}
        activeOpacity={revealed ? 1 : 0.7}
      >
        <Text className="text-6xl font-light text-gray-900 mb-4">
          {card.hanzi}
        </Text>

        {revealed ? (
          <View className="items-center">
            <Text className="text-xl text-gray-500 mb-2">{card.pinyin}</Text>
            <Text className="text-lg text-gray-700">{card.english}</Text>
          </View>
        ) : (
          <Text className="text-gray-400 text-sm mt-4">
            Tap to reveal
          </Text>
        )}
      </TouchableOpacity>

      {/* Grade buttons */}
      {revealed && (
        <View className="flex-row mx-5 mt-4 mb-8 gap-3">
          <TouchableOpacity
            className="flex-1 py-4 bg-gray-100 rounded-2xl items-center"
            onPress={() => handleGrade("again")}
          >
            <Text className="text-gray-700 font-medium">Again</Text>
            <Text className="text-gray-400 text-xs mt-0.5">1 day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-4 bg-green-50 rounded-2xl items-center"
            onPress={() => handleGrade("good")}
          >
            <Text className="text-green-700 font-medium">Good</Text>
            <Text className="text-green-400 text-xs mt-0.5">×ease</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-4 bg-blue-50 rounded-2xl items-center"
            onPress={() => handleGrade("easy")}
          >
            <Text className="text-blue-700 font-medium">Easy</Text>
            <Text className="text-blue-400 text-xs mt-0.5">×ease×1.3</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
