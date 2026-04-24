import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Screen, Text } from "@/components/ui";
import {
  fetchDict,
  fetchUserCharacters,
  joinWithProgress,
  type CharacterWithProgress,
} from "@/features/character/character";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type Filter = "all" | "learning" | "mastered" | "new";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "learning", label: "Learning" },
  { id: "mastered", label: "Mastered" },
];

export default function CharacterRoadmap() {
  const theme = useTheme();
  const session = useUserStore((s) => s.session);

  const [loading, setLoading] = useState(true);
  const [chars, setChars] = useState<CharacterWithProgress[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [dict, prog] = await Promise.all([
        fetchDict(1),
        fetchUserCharacters(session.user.id),
      ]);
      if (cancelled) return;
      setChars(joinWithProgress(dict, prog));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const filtered = useMemo(() => {
    return chars.filter((c) => {
      const step = c.progress?.step_completed ?? 0;
      switch (filter) {
        case "new":
          return step === 0;
        case "learning":
          return step > 0 && step < 5;
        case "mastered":
          return step >= 5;
        default:
          return true;
      }
    });
  }, [chars, filter]);

  const totals = useMemo(() => {
    const acc = { total: chars.length, new: 0, learning: 0, mastered: 0 };
    for (const c of chars) {
      const step = c.progress?.step_completed ?? 0;
      if (step === 0) acc.new += 1;
      else if (step >= 5) acc.mastered += 1;
      else acc.learning += 1;
    }
    return acc;
  }, [chars]);

  return (
    <Screen>
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Back">
            <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
          </Pressable>
          <Text variant="h3">Characters</Text>
          <View style={{ width: 24 }} />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            padding: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Stat label="Total" value={totals.total} />
          <Stat label="Learning" value={totals.learning} color="warning" />
          <Stat label="Mastered" value={totals.mastered} color="success" />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.xs }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: theme.radii.full,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                }}
              >
                <Text variant="small" color={active ? "onAccent" : "secondary"}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {filtered.map((c) => (
              <CharCell
                key={c.hanzi}
                char={c}
                onPress={() => router.push(`/(app)/character/${encodeURIComponent(c.hanzi)}`)}
              />
            ))}
          </View>
          {filtered.length === 0 ? (
            <Text variant="body" color="secondary" align="center" style={{ padding: theme.spacing["2xl"] }}>
              Nothing here yet.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function CharCell({ char, onPress }: { char: CharacterWithProgress; onPress: () => void }) {
  const theme = useTheme();
  const step = char.progress?.step_completed ?? 0;

  const tone: "new" | "learning" | "mastered" =
    step === 0 ? "new" : step >= 5 ? "mastered" : "learning";

  const borderColor =
    tone === "mastered"
      ? theme.colors.success
      : tone === "learning"
        ? theme.colors.warning
        : theme.colors.border;
  const bgColor = tone === "new" ? theme.colors.surface : theme.colors.bg;
  const badge = tone === "new" ? null : `${step}/5`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${char.hanzi} — ${char.meanings[0] ?? ""}`}
      style={{
        width: 72,
        height: 92,
        borderRadius: theme.radii.md,
        borderWidth: 2,
        borderColor,
        backgroundColor: bgColor,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Text chinese style={{ fontSize: 30, lineHeight: 34, fontWeight: "700" }}>
        {char.hanzi}
      </Text>
      <Text variant="caption" color="tertiary" numberOfLines={1}>
        {char.pinyin[0] ?? ""}
      </Text>
      {badge ? (
        <Text
          variant="caption"
          color={tone === "mastered" ? "success" : "warning"}
          style={{ fontWeight: "700" }}
        >
          {badge}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Stat({
  label,
  value,
  color = "primary",
}: {
  label: string;
  value: number;
  color?: "primary" | "success" | "warning";
}) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text variant="h2" color={color}>
        {value}
      </Text>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
    </View>
  );
}
