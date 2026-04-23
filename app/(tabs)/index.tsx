import { useEffect } from "react";
import { View, Text, ScrollView, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import scenarios from "../../assets/scenarios.json";
import { ScenarioCard } from "../../components/ScenarioCard";
import { LevelPicker } from "../../components/LevelPicker";
import { useUserStore } from "../../stores/userStore";
import { useSessionStore } from "../../stores/sessionStore";
import type { HskLevel, Scenario } from "../../types";

export default function HomeScreen() {
  const router = useRouter();
  const { profile, updateHskLevel } = useUserStore();
  const { setScenario } = useSessionStore();

  const hskLevel: HskLevel = (profile?.hsk_level ?? 1) as HskLevel;

  const handleScenarioPress = (scenario: Scenario) => {
    setScenario(scenario, hskLevel);
    router.push(`/(tabs)/practice?scenario=${scenario.id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 pt-6 pb-4">
          <Text className="text-2xl font-bold text-gray-900">MandarinAI</Text>
          <Text className="text-gray-500 mt-1">Pick a scenario to practice</Text>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Your HSK Level
          </Text>
          <LevelPicker
            value={hskLevel}
            onChange={(level) => updateHskLevel(level)}
          />
        </View>

        <View className="px-5">
          <Text className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
            Scenarios
          </Text>
          {(scenarios as Scenario[]).map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onPress={() => handleScenarioPress(s)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
