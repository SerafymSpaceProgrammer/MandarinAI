import { Tabs, Redirect } from "expo-router";
import { Text, View, ActivityIndicator } from "react-native";
import { useUserStore } from "../../stores/userStore";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20 }}>{label}</Text>
  );
}

export default function TabsLayout() {
  const { session, sessionLoaded } = useUserStore();

  if (!sessionLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#E63946",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: { borderTopWidth: 1, borderTopColor: "#F3F4F6" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="🏠" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: "Practice",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="🎙️" focused={focused} />
          ),
          href: null,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: "Review",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="📚" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon label="👤" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
