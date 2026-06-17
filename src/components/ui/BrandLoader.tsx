import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { useTheme } from "@/theme";

/**
 * Full-screen branded loader. Used at app boot while the auth session
 * deserializes from AsyncStorage and the profile loads. Far less janky-
 * feeling than the bare ActivityIndicator — the 中-square mark matches
 * the rest of the brand surface (header marks, widget logo, landing).
 *
 * The animation runs entirely on the native driver so it stays smooth
 * even if the JS thread is busy bootstrapping Supabase / RevenueCat.
 */
export function BrandLoader() {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.05,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.9,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.bg,
        gap: theme.spacing.lg,
      }}
    >
      <Animated.View
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.accent,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: theme.colors.accent,
          shadowOpacity: 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
          transform: [{ scale }],
          opacity,
        }}
      >
        <Animated.Text
          style={{
            color: theme.colors.onAccent,
            fontSize: 36,
            fontWeight: "700",
            fontFamily: theme.fonts.chinese,
          }}
        >
          中
        </Animated.Text>
      </Animated.View>

      <Animated.View
        style={{
          width: 64,
          height: 3,
          borderRadius: 2,
          backgroundColor: theme.colors.accent,
          opacity,
        }}
      />
    </View>
  );
}
