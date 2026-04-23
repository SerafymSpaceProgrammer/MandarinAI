import { TouchableOpacity, View, Text } from "react-native";
import type { Scenario } from "../types";

interface Props {
  scenario: Scenario;
  onPress: () => void;
}

const SCENARIO_EMOJIS: Record<string, string> = {
  cafe_order: "☕",
  taxi_ride: "🚕",
  restaurant: "🍜",
  intro_self: "👋",
  shopping: "🛍️",
  directions: "🗺️",
  hotel_checkin: "🏨",
  small_talk: "💬",
};

export function ScenarioCard({ scenario, onPress }: Props) {
  const emoji = SCENARIO_EMOJIS[scenario.id] ?? "🗣️";

  return (
    <TouchableOpacity
      className="flex-row items-center bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 bg-red-50 rounded-xl items-center justify-center mr-4">
        <Text className="text-2xl">{emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-800">
          {scenario.title_en}
        </Text>
        <Text className="text-gray-400 text-sm mt-0.5">{scenario.title_zh}</Text>
      </View>
      <Text className="text-gray-300 text-xl">›</Text>
    </TouchableOpacity>
  );
}
