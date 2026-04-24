import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { Button, Card, Screen, Text } from "@/components/ui";
import { dueCountOnDay } from "@/features/vocab/vocab";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

export default function ReviewSummary() {
  const theme = useTheme();
  const session = useUserStore((s) => s.session);
  const params = useLocalSearchParams<{ reviewed?: string; correct?: string; minutes?: string }>();

  const reviewed = Number(params.reviewed ?? 0);
  const correct = Number(params.correct ?? 0);
  const minutes = Number(params.minutes ?? 0);
  const accuracy = reviewed === 0 ? 0 : Math.round((correct / reviewed) * 100);
  const xp = correct * 2 + (reviewed - correct);

  const [tomorrow, setTomorrow] = useState<number | null>(null);

  const scale = useRef(new Animated.Value(0.7)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, scale]);

  useEffect(() => {
    if (!session) return;
    const next = new Date();
    next.setDate(next.getDate() + 1);
    dueCountOnDay(session.user.id, next).then(setTomorrow);
  }, [session]);

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing["2xl"] }}>
        <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: "center", gap: theme.spacing.md }}>
          <Text chinese style={{ fontSize: 72, lineHeight: 80, color: theme.colors.accent, fontWeight: "700" }}>
            干杯
          </Text>
          <Text variant="h1" align="center">
            Session done
          </Text>
          <Text variant="body" color="secondary" align="center">
            {reviewed} {reviewed === 1 ? "card" : "cards"} reviewed · {accuracy}% correct · {minutes} min
          </Text>
        </Animated.View>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <Stat label="Reviewed" value={reviewed} />
            <Stat label="Correct" value={correct} color="success" />
            <Stat label="XP" value={xp} color="accent" />
          </View>
        </Card>

        {tomorrow !== null ? (
          <Text variant="small" color="tertiary" align="center">
            Tomorrow you have {tomorrow} {tomorrow === 1 ? "card" : "cards"} due.
          </Text>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Review more"
            fullWidth
            onPress={() => router.replace("/(app)/vocab/review")}
          />
          <Button
            label="Done"
            variant="ghost"
            fullWidth
            onPress={() => router.replace("/(app)")}
          />
        </View>
      </View>
    </Screen>
  );
}

function Stat({
  label,
  value,
  color = "primary",
}: {
  label: string;
  value: number;
  color?: "primary" | "accent" | "success";
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
