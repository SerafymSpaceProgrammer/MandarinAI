import { router } from "expo-router";
import { ArrowLeft, Headphones, Play, Tv } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { getEntryLevels, listEntries } from "@/features/watch/loader";
import type { WatchEntry } from "@/features/watch/types";
import { useTheme } from "@/theme";

type LevelFilter = "all" | number;

export default function WatchCatalog() {
  const theme = useTheme();
  const [filter, setFilter] = useState<LevelFilter>("all");

  const entries = useMemo(() => listEntries(), []);
  const levels = useMemo(() => getEntryLevels(), []);
  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.hskLevel === filter)),
    [entries, filter],
  );

  return (
    <Screen>
      <View
        style={{
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Назад">
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            ПРАКТИКА · СМОТРЕТЬ
          </Text>
          <Text variant="h3">Видео и подкасты</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          paddingBottom: theme.spacing["5xl"],
        }}
      >
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.accentMuted,
            gap: 4,
          }}
        >
          <Text variant="caption" color="accent">
            КАК ЭТО РАБОТАЕТ
          </Text>
          <Text variant="small">
            Нажмите на любое слово в субтитрах — видео остановится и появится
            попап с пиньинем, значениями, озвучкой и порядком черт. Можно
            сразу сохранить слово в свою колоду.
          </Text>
        </View>

        {/* Level filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          <FilterChip
            label="Все"
            count={entries.length}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          {levels.map((lvl) => (
            <FilterChip
              key={lvl}
              label={`HSK ${lvl}`}
              count={entries.filter((e) => e.hskLevel === lvl).length}
              active={filter === lvl}
              onPress={() => setFilter(lvl)}
            />
          ))}
        </ScrollView>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          {filtered.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function EntryCard({ entry }: { entry: WatchEntry }) {
  const theme = useTheme();
  const SourceIcon = entry.source === "youtube" ? Tv : Headphones;
  return (
    <Card
      onPress={() => router.push(`/(app)/practice/watch-session?id=${entry.id}`)}
      bordered
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.lg }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.accentMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 36, lineHeight: 40 }}>{entry.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {entry.title}
          </Text>
          <Text variant="small" color="secondary" numberOfLines={2}>
            {entry.blurb}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.xs,
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            <Pill text={`HSK ${entry.hskLevel}`} tone="accent" />
            <Pill
              text={entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
              tone="neutral"
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <SourceIcon color={theme.colors.textTertiary} size={12} strokeWidth={2} />
              <Text variant="caption" color="tertiary">
                {Math.round(entry.durationSec / 60) || 1} мин
              </Text>
            </View>
          </View>
        </View>
        <Play color={theme.colors.textTertiary} size={20} strokeWidth={2} />
      </View>
    </Card>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: 10,
        borderRadius: theme.radii.full,
        backgroundColor: active ? theme.colors.accent : theme.colors.surface,
        borderWidth: 1,
        borderColor: active ? theme.colors.accent : theme.colors.border,
      }}
    >
      <Text variant="smallStrong" color={active ? "onAccent" : "primary"}>
        {label}
      </Text>
      <Text
        variant="caption"
        color={active ? "onAccent" : "tertiary"}
        style={{ opacity: 0.85 }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function Pill({ text, tone }: { text: string; tone: "accent" | "neutral" }) {
  const theme = useTheme();
  const bg = tone === "accent" ? theme.colors.accentMuted : theme.colors.surfaceHover;
  const color: "accent" | "tertiary" = tone === "accent" ? "accent" : "tertiary";
  return (
    <View
      style={{
        paddingVertical: 1,
        paddingHorizontal: 8,
        borderRadius: theme.radii.full,
        backgroundColor: bg,
      }}
    >
      <Text variant="caption" color={color}>
        {text}
      </Text>
    </View>
  );
}
