import { forwardRef, useRef } from "react";
import {
  Animated,
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps as RNPressableProps,
  type ViewStyle,
} from "react-native";

import { haptics } from "@/lib/haptics";

type HapticStrength = "none" | "light" | "medium" | "heavy" | "selection";

export type PressableProps = Omit<RNPressableProps, "style"> & {
  style?: ViewStyle | ViewStyle[];
  /** Haptic to fire on press. Default: "light". */
  haptic?: HapticStrength;
  /** Scale factor while pressed. Default: 0.97. Set to 1 to disable. */
  pressedScale?: number;
  /** Disable the pressed visual feedback entirely. */
  noScale?: boolean;
};

export const Pressable = forwardRef<any, PressableProps>(function Pressable(
  { style, haptic = "light", pressedScale = 0.97, noScale, onPressIn, onPressOut, onPress, ...rest },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!noScale && pressedScale !== 1) {
      Animated.spring(scale, { toValue: pressedScale, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (!noScale && pressedScale !== 1) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
    }
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic !== "none") {
      if (haptic === "selection") haptics.selection();
      else haptics[haptic]();
    }
    onPress?.(e);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <RNPressable
        ref={ref}
        {...rest}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={style}
      />
    </Animated.View>
  );
});
