import { Tabs } from "expo-router";
import {
  BarChart3,
  GraduationCap,
  Home as HomeIcon,
  Mic,
  User,
  type LucideProps,
} from "lucide-react-native";
import { Platform } from "react-native";

import { useTheme } from "@/theme";

type TabIconProps = {
  color: string;
  size?: number;
  focused: boolean;
};

function makeTabIcon(Icon: React.ComponentType<LucideProps>) {
  return function TabIcon({ color, focused }: TabIconProps) {
    return <Icon color={color} size={24} strokeWidth={focused ? 2.4 : 1.8} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: makeTabIcon(HomeIcon),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Learn",
          tabBarIcon: makeTabIcon(GraduationCap),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: "Practice",
          tabBarIcon: makeTabIcon(Mic),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: makeTabIcon(BarChart3),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: makeTabIcon(User),
        }}
      />
    </Tabs>
  );
}
