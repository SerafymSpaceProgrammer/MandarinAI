import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Modal as RNModal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

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
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: theme.duration.emphasis,
      useNativeDriver: true,
    }).start();
  }, [visible, slide, theme.duration.emphasis]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const backdropOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const sheetStyles: ViewStyle = {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing["3xl"],
    maxHeight: "85%",
    ...theme.shadows.xl,
  };

  const centerStyles: ViewStyle = {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    width: "86%",
    maxWidth: 400,
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
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity, backgroundColor: theme.colors.overlay }]}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={handleOutside} />
        <Animated.View
          style={[
            presentation === "sheet" ? styles.sheetWrapper : styles.centerWrapper,
            { transform: [{ translateY }] },
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
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetWrapper: {
    width: "100%",
  },
  centerWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
