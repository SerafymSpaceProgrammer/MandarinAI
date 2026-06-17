import { Tabs, useSegments } from "expo-router";
import {
  BarChart3,
  GraduationCap,
  Home as HomeIcon,
  Mic,
  User,
  type LucideProps,
} from "lucide-react-native";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/theme";

const ICON_BY_NAME: Record<string, React.ComponentType<LucideProps>> = {
  index: HomeIcon,
  learn: GraduationCap,
  practice: Mic,
  stats: BarChart3,
  profile: User,
};

const VISIBLE_TABS = ["index", "learn", "practice", "stats", "profile"] as const;
type VisibleTab = (typeof VISIBLE_TABS)[number];

/**
 * Hidden sub-routes that should keep their "logical parent" tab highlighted.
 *
 * Without this map, navigating into e.g. /vocab/browse leaves the bar with
 * no active tab — the focused route is `vocab`, which is registered with
 * `href: null` and so has no button to light up. The user reads this as a
 * bug ("the Learn tab lost its highlight"). The default Tabs renderer
 * doesn't expose a way to redirect highlight across sibling routes, so we
 * render the tab bar ourselves and compute `focused` from this table.
 */
const TAB_PARENT: Record<string, VisibleTab> = {
  vocab: "learn",
  character: "learn",
  exercises: "learn",
  hsk: "learn",
  grammar: "learn",
  reading: "learn",
  subscription: "profile",
};

// Minimal slice of @react-navigation/bottom-tabs `BottomTabBarProps` that we
// need — keeps the layout file from taking a direct dep on a transitive
// package and lets the type stay readable.
type TabBarProps = {
  state: {
    index: number;
    routes: { name: string; key: string; params?: object }[];
  };
  navigation: {
    navigate: (name: string, params?: object) => void;
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
};

/**
 * Custom bottom tab bar. Renders the five visible tabs and remaps focus
 * for hidden sub-routes via `TAB_PARENT`. The visuals mirror the previous
 * `Tabs` defaults (accent dot, icon, label, safe-area padding) so this is
 * a pure-fix change — no design impact.
 */
function CustomTabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const segments = useSegments();

  // Android phones with 3-button nav or gesture pill report a non-zero
  // `insets.bottom` — pad the bar so it sits above the system controls.
  const tabBarPaddingBottom = Math.max(
    insets.bottom,
    Platform.OS === "ios" ? 6 : 8,
  );

  // Read the active tab from the URL segments rather than the navigator
  // state — segments are deterministic and survive any internal Tabs
  // routing quirks with `href: null` siblings. Inside the (app) layout,
  // segments[0] is "(app)" and segments[1] is the tab folder name (or
  // undefined when we're on /(app)/index). Belt-and-suspenders: fall
  // back to the navigator's own focused route if segments come back
  // empty for some reason (e.g. very first paint before router hydrates).
  const segList = segments as string[];
  const groupIdx = segList.findIndex((s) => s === "(app)");
  const rawSegmentTab = groupIdx >= 0 ? segList[groupIdx + 1] : undefined;
  const stateTab = state.routes[state.index]?.name;
  const tabSegment =
    rawSegmentTab && rawSegmentTab.length > 0
      ? rawSegmentTab
      : stateTab || "index";
  const logicalActive: VisibleTab =
    TAB_PARENT[tabSegment] ??
    ((VISIBLE_TABS as readonly string[]).includes(tabSegment)
      ? (tabSegment as VisibleTab)
      : "index");

  const LABELS: Record<VisibleTab, string> = {
    index: t.tabs.home,
    learn: t.tabs.learn,
    practice: t.tabs.practice,
    stats: t.tabs.stats,
    profile: t.tabs.profile,
  };

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: theme.colors.bg,
        borderTopColor: theme.colors.border,
        borderTopWidth: 1,
        paddingTop: 6,
        paddingBottom: tabBarPaddingBottom,
        height: 54 + tabBarPaddingBottom,
      }}
    >
      {VISIBLE_TABS.map((name) => {
        const isFocused = logicalActive === name;
        const color = isFocused
          ? theme.colors.accent
          : theme.colors.textTertiary;
        const Icon = ICON_BY_NAME[name]!;
        const route = state.routes.find((r) => r.name === name);

        const onPress = () => {
          if (!route) return;
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={LABELS[name]}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <View
              style={{ alignItems: "center", justifyContent: "center", gap: 3 }}
            >
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isFocused ? color : "transparent",
                }}
              />
              <Icon color={color} size={22} strokeWidth={isFocused ? 2.4 : 1.8} />
            </View>
            <Text
              style={{
                color,
                fontSize: 11,
                lineHeight: 14,
                fontWeight: "500",
              }}
            >
              {LABELS[name]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
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
 *
 * The visible tab bar is rendered by `CustomTabBar` so we can remap focus
 * from a hidden sub-route to its logical parent tab (e.g. /vocab/browse
 * still lights up "Учить"). The default Tabs renderer can't do that.
 */
export default function AppLayout() {
  const t = useT();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...(props as TabBarProps)} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Tabs — these are the routes the custom bar renders buttons for */}
      <Tabs.Screen name="index" options={{ title: t.tabs.home }} />
      <Tabs.Screen name="learn" options={{ title: t.tabs.learn }} />
      <Tabs.Screen name="practice" options={{ title: t.tabs.practice }} />
      <Tabs.Screen name="stats" options={{ title: t.tabs.stats }} />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile }} />

      {/* Hidden sub-routes — registered so the router knows the file tree,
          but the custom bar redirects their focus to TAB_PARENT[name]. */}
      <Tabs.Screen name="vocab" options={{ href: null }} />
      <Tabs.Screen name="character" options={{ href: null }} />
      <Tabs.Screen name="exercises" options={{ href: null }} />
      <Tabs.Screen name="hsk" options={{ href: null }} />
      <Tabs.Screen name="grammar" options={{ href: null }} />
      <Tabs.Screen name="reading" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
    </Tabs>
  );
}
