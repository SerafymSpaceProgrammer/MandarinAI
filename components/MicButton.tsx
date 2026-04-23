import { TouchableOpacity, View, Text, ActivityIndicator } from "react-native";

interface Props {
  isActive: boolean;
  isLoading: boolean;
  onPress: () => void;
}

export function MicButton({ isActive, isLoading, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.8}
      className="items-center justify-center"
    >
      {/* Pulse ring when active */}
      {isActive && (
        <View className="absolute w-28 h-28 rounded-full bg-red-100 opacity-60" />
      )}
      <View
        className={`w-24 h-24 rounded-full items-center justify-center shadow-lg ${
          isActive ? "bg-accent" : "bg-gray-900"
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Text className="text-4xl">{isActive ? "⏹" : "🎙️"}</Text>
        )}
      </View>
      <Text className="mt-3 text-gray-500 text-sm">
        {isLoading ? "Connecting…" : isActive ? "Tap to stop turn" : "Tap to speak"}
      </Text>
    </TouchableOpacity>
  );
}
