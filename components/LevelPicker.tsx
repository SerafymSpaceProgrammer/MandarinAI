import { View, Text, TouchableOpacity } from "react-native";
import type { HskLevel } from "../types";

interface Props {
  value: HskLevel;
  onChange: (level: HskLevel) => void;
}

export function LevelPicker({ value, onChange }: Props) {
  const levels: HskLevel[] = [1, 2, 3, 4, 5, 6];

  return (
    <View className="flex-row gap-2">
      {levels.map((level) => (
        <TouchableOpacity
          key={level}
          onPress={() => onChange(level)}
          className={`flex-1 py-2 rounded-xl items-center ${
            value === level ? "bg-accent" : "bg-gray-100"
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              value === level ? "text-white" : "text-gray-600"
            }`}
          >
            {level}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
