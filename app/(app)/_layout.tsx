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

import { useT } from "@/i18n/i18n";
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

/**
 * Root layout for the authenticated experience. Uses Tabs directly so the
 * bottom bar remains visible across every sub-route — vocab/browse,
 * character roadmap, practice scenarios, exercise runner, etc. all show
 * the tab bar while the user navigates, matching the feel of Duolingo /
 * Anki / Quizlet.
 *
 * Sub-route folders (vocab, character, exercises) are registered here with
 * `href: null` so expo-router knows about them but omits them from the tab
 * bar. Each has its own _layout.tsx Stack for deep nav within the tab.
 */
export default function AppLayout() {
  const theme = useTheme();
  const t = useT();

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
      {/* Tabs */}
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: makeTabIcon(HomeIcon) }} />
      <Tabs.Screen name="learn" options={{ title: t.tabs.learn, tabBarIcon: makeTabIcon(GraduationCap) }} />
      <Tabs.Screen name="practice" options={{ title: t.tabs.practice, tabBarIcon: makeTabIcon(Mic) }} />
      <Tabs.Screen name="stats" options={{ title: t.tabs.stats, tabBarIcon: makeTabIcon(BarChart3) }} />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile, tabBarIcon: makeTabIcon(User) }} />

      {/* Hidden sub-routes — mapped but not shown in the tab bar */}
      <Tabs.Screen name="vocab" options={{ href: null }} />
      <Tabs.Screen name="character" options={{ href: null }} />
      <Tabs.Screen name="exercises" options={{ href: null }} />
      <Tabs.Screen name="hsk" options={{ href: null }} />
    </Tabs>
  );
}
