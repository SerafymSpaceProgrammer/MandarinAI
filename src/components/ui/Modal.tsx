import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal as RNModal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Visual presentation. "sheet" = slide up from bottom. "center" = centered dialog. */
  presentation?: "sheet" | "center";
  /** Tap backdrop to dismiss. Default: true. */
  dismissOnBackdrop?: boolean;
  contentStyle?: ViewStyle;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function Modal({
  visible,
  onClose,
  children,
  title,
  presentation = "sheet",
  dismissOnBackdrop = true,
  contentStyle,
}: ModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Two values so we can give the sheet a spring entrance and a cleaner fade
  // exit. backdrop opacity shares `backdrop`, sheet uses its own `slide`.
  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(slide, {
          toValue: 1,
          useNativeDriver: true,
          friction: 11,
          tension: 65,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdrop, slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.5, 0],
    extrapolate: "clamp",
  });

  const sheetBottomPad =
    presentation === "sheet"
      ? Math.max(insets.bottom + theme.spacing.md, theme.spacing["2xl"])
      : theme.spacing.xl;

  const sheetStyles: ViewStyle = {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: sheetBottomPad,
    // Absolute-anchored to the bottom of the window so the sheet always
    // touches the screen edge. maxHeight uses an absolute px value (not %)
    // because sheetWrapper has no intrinsic height for % to resolve against,
    // which was the silent reason the sheet was floating mid-screen.
    maxHeight: SCREEN_HEIGHT * 0.92,
    ...theme.shadows.xl,
  };

  const centerStyles: ViewStyle = {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    width: "86%",
    maxWidth: 400,
    maxHeight: "85%",
    ...theme.shadows.xl,
  };

  const handleOutside = () => {
    if (dismissOnBackdrop) onClose();
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: backdrop, backgroundColor: theme.colors.overlay },
        ]}
      >
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={handleOutside} />
        <Animated.View
          style={[
            presentation === "sheet" ? styles.sheetWrapper : styles.centerWrapper,
            { transform: [{ translateY }], opacity: slide },
          ]}
        >
          <View
            style={[presentation === "sheet" ? sheetStyles : centerStyles, contentStyle]}
            accessibilityViewIsModal
          >
            {presentation === "sheet" ? (
              <View
                style={{
                  alignSelf: "center",
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: theme.colors.border,
                  marginBottom: theme.spacing.md,
                }}
              />
            ) : null}
            {title ? (
              <Text variant="h2" style={{ marginBottom: theme.spacing.md }}>
                {title}
              </Text>
            ) : null}
            <View style={{ flexShrink: 1 }}>{children}</View>
          </View>
        </Animated.View>
      </Animated.View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  // Absolute-anchored so the sheet sticks to the bottom of the window no
  // matter how tall its content is. The previous flex + justifyContent
  // approach placed the sheet "at the bottom" of an unsized flex child,
  // which on some devices let short sheets float above the home indicator.
  sheetWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  centerWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
