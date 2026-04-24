import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/theme";

/**
 * The root index is a brief splash while the AuthGate (in _layout.tsx)
 * reads the persisted session and redirects to (auth) / (onboarding) / (app).
 */
export default function Index() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg }}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}
