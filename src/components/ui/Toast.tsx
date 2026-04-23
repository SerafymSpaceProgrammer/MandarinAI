import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type ToastKind = "info" | "success" | "warning" | "error";

type ToastMessage = {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number;
};

type ShowOpts = {
  title?: string;
  message: string;
  kind?: ToastKind;
  duration?: number;
};

type ToastApi = {
  show: (opts: ShowOpts) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const counter = useRef(0);

  const show = useCallback((opts: ShowOpts) => {
    counter.current += 1;
    setCurrent({
      id: counter.current,
      kind: opts.kind ?? "info",
      title: opts.title,
      message: opts.message,
      duration: opts.duration ?? 3000,
    });
  }, []);

  const api: ToastApi = useMemo(
    () => ({
      show,
      success: (m, t) => show({ message: m, title: t, kind: "success" }),
      error: (m, t) => show({ message: m, title: t, kind: "error" }),
      warning: (m, t) => show({ message: m, title: t, kind: "warning" }),
      info: (m, t) => show({ message: m, title: t, kind: "info" }),
      dismiss: () => setCurrent(null),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? <ToastView key={current.id} toast={current} onDismiss={() => setCurrent(null)} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside a <ToastProvider>");
  return ctx;
}

function ToastView({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
    const timeout = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: theme.duration.standard,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, toast.duration);
    return () => clearTimeout(timeout);
  }, [anim, onDismiss, toast.duration, theme.duration.standard]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
  const opacity = anim;

  const kindColor: Record<ToastKind, string> = {
    info: theme.colors.info,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.danger,
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { top: insets.top + 12, opacity, transform: [{ translateY }] },
      ]}
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderLeftWidth: 4,
          borderLeftColor: kindColor[toast.kind],
          maxWidth: 480,
          ...theme.shadows.md,
        }}
      >
        {toast.title ? (
          <Text variant="bodyStrong" style={{ marginBottom: 2 }}>
            {toast.title}
          </Text>
        ) : null}
        <Text variant="small" color="secondary">
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
  },
});
