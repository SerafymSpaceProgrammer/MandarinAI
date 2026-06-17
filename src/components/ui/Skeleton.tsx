import { useEffect, useRef, useState } from "react";
import { Animated, Easing, type LayoutChangeEvent, View, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: "sm" | "md" | "lg" | "full";
  style?: ViewStyle | ViewStyle[];
};

/**
 * Shimmer skeleton. A translucent band sweeps left-to-right across a
 * surface-coloured rectangle, giving a more "alive" loading feel than the
 * previous breathing-opacity placeholder. Width is measured at runtime so
 * the band travels exactly the visible distance even when the skeleton is
 * laid out flex-stretched ("100%").
 */
export function Skeleton({ width = "100%", height = 16, radius = "sm", style }: SkeletonProps) {
  const theme = useTheme();
  const translate = useRef(new Animated.Value(0)).current;
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);

  useEffect(() => {
    if (measuredWidth === 0) return;
    const loop = Animated.loop(
      Animated.timing(translate, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [translate, measuredWidth]);

  function onLayout(e: LayoutChangeEvent): void {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
  }

  // The band itself is ~40% of the row width; we slide it from one edge
  // off-screen to the other so it sweeps fully across.
  const bandWidth = Math.max(40, measuredWidth * 0.4);
  const bandTranslate = translate.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, measuredWidth],
  });

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width,
          height,
          borderRadius: theme.radii[radius],
          backgroundColor: theme.colors.surfaceHover,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {measuredWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: bandWidth,
            // A subtle highlight — using the bg colour at ~30% opacity blends
            // softly on both light and dark themes.
            backgroundColor: theme.colors.bg,
            opacity: 0.35,
            transform: [{ translateX: bandTranslate }],
          }}
        />
      ) : null}
    </View>
  );
}
