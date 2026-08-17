import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { logger } from "@/lib/logger";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Root-level crash guard. Sits OUTSIDE ThemeProvider/I18nProvider so it can
 * catch failures inside them — which is why it uses plain styles and fixed
 * copy instead of theme tokens / useT(). Without it, any render throw in
 * production is a permanent white screen with no recovery path.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logger.error("Unhandled render error", error.message, info.componentStack ?? "");
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.hanzi}>哎呀</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          An unexpected error occurred. Tap below to reload the screen.
        </Text>
        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    // Neutral dark that reads fine over either the light or dark native shell.
    backgroundColor: "#111318",
  },
  hanzi: {
    fontSize: 56,
    marginBottom: 16,
    color: "#E63946",
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#9BA1AC",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#E63946",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
