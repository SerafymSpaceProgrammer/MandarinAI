import { useEffect, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: "sm" | "md" | "lg" | "full";
  style?: ViewStyle | ViewStyle[];
};

export function Skeleton({ width = "100%", height = 16, radius = "sm", style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width,
          height,
          borderRadius: theme.radii[radius],
          backgroundColor: theme.colors.surfaceHover,
          opacity,
        },
        style,
      ]}
    />
  );
}
