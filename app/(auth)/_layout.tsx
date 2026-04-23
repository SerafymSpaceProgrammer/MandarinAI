import { Stack, Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useUserStore } from "../../stores/userStore";

export default function AuthLayout() {
  const { session, sessionLoaded } = useUserStore();

  if (!sessionLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (session) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
