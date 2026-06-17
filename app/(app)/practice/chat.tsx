import { router } from "expo-router";
import { ArrowLeft, RotateCcw, Send } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Card, Screen, Text } from "@/components/ui";
import { sendTutorMessage, type ChatMsg, type TutorError } from "@/features/chat/tutor";
import { useT } from "@/i18n/i18n";
import { fmt, type Translations } from "@/i18n/strings";
import { useUserStore } from "@/stores/userStore";
import { useTheme } from "@/theme";

type UiMessage = ChatMsg & { id: string };

let nextId = 1;
function newId(): string {
  return `m${nextId++}`;
}

export default function ChatTutor() {
  const theme = useTheme();
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const nativeLang = profile?.native_language ?? "en";
  const hskLevel = profile?.hsk_level ?? 2;

  const [messages, setMessages] = useState<UiMessage[]>(() => [
    { id: newId(), role: "assistant", content: t.chat.greeting },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TutorError | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Refresh greeting if the user's native language changes (e.g. after
  // returning from settings) and the chat is otherwise untouched.
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== "assistant") return prev;
      return [{ id: newId(), role: "assistant", content: t.chat.greeting }];
    });
  }, [t.chat.greeting]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || pending) return;

    const userMsg: UiMessage = { id: newId(), role: "user", content: text };
    const history: ChatMsg[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setPending(true);
    scrollToEnd();

    const result = await sendTutorMessage(history, hskLevel, nativeLang);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      scrollToEnd();
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "assistant", content: result.reply },
    ]);
    scrollToEnd();
  }, [input, pending, messages, hskLevel, nativeLang, scrollToEnd]);

  const reset = useCallback(() => {
    setMessages([{ id: newId(), role: "assistant", content: t.chat.greeting }]);
    setInput("");
    setError(null);
  }, [t.chat.greeting]);

  return (
    <Screen padded>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel={t.common.back}>
          <ArrowLeft color={theme.colors.textSecondary} size={24} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {t.chat.eyebrow}
          </Text>
          <Text variant="h3">{fmt(t.chat.title, { n: hskLevel })}</Text>
        </View>
        <Pressable
          onPress={reset}
          hitSlop={12}
          accessibilityLabel={t.chat.resetA11y}
          disabled={pending}
          style={{ opacity: pending ? 0.4 : 1 }}
        >
          <RotateCcw color={theme.colors.textSecondary} size={22} strokeWidth={2} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
          onContentSizeChange={scrollToEnd}
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {pending ? <PendingBubble label={t.chat.pendingLabel} /> : null}
          {error ? <ErrorRow error={error} t={t} onRetry={send} /> : null}
        </ScrollView>

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: theme.spacing.sm,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.bg,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t.chat.composerPlaceholder}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            editable={!pending}
            style={{
              flex: 1,
              minHeight: 48,
              maxHeight: 140,
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 12,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
              fontFamily: theme.fonts.latin,
              fontSize: theme.typography.body.fontSize,
            }}
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || pending}
            accessibilityLabel="Send"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                !input.trim() || pending ? theme.colors.surface : theme.colors.accent,
              borderWidth: 1,
              borderColor:
                !input.trim() || pending ? theme.colors.border : theme.colors.accent,
            }}
          >
            <Send
              color={
                !input.trim() || pending ? theme.colors.textTertiary : theme.colors.onAccent
              }
              size={20}
              strokeWidth={2.4}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bubbles
// ──────────────────────────────────────────────────────────────────────────

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const theme = useTheme();
  const isUser = role === "user";
  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "88%",
      }}
    >
      <Card
        padding="md"
        bordered={!isUser}
        style={{
          backgroundColor: isUser ? theme.colors.accent : theme.colors.surface,
          borderRadius: theme.radii.lg,
        }}
      >
        <Text
          variant="body"
          color={isUser ? "onAccent" : "primary"}
          selectable
          style={{ fontFamily: theme.fonts.latin }}
        >
          {content}
        </Text>
      </Card>
    </View>
  );
}

function PendingBubble({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", maxWidth: "60%" }}>
      <Card
        padding="md"
        bordered
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
        }}
      >
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text variant="small" color="secondary">
          {label}
        </Text>
      </Card>
    </View>
  );
}

function ErrorRow({
  error,
  t,
  onRetry,
}: {
  error: TutorError;
  t: Translations;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const message = errorMessage(error, t);
  return (
    <View
      style={{
        alignSelf: "stretch",
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.danger,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text variant="smallStrong" color="danger">
        {message.title}
      </Text>
      {message.body ? (
        <Text variant="small" color="secondary">
          {message.body}
        </Text>
      ) : null}
      {error.kind !== "daily_limit" && error.kind !== "not_authenticated" ? (
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          style={{ alignSelf: "flex-start", marginTop: theme.spacing.xs }}
        >
          <Text variant="smallStrong" color="accent">
            {t.chat.retry}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function errorMessage(error: TutorError, t: Translations): { title: string; body?: string } {
  switch (error.kind) {
    case "not_authenticated":
      return { title: t.chat.errAuthTitle, body: t.chat.errAuthBody };
    case "daily_limit":
      return {
        title: t.chat.errLimitTitle,
        body: fmt(t.chat.errLimitBody, { used: error.used, limit: error.limit }),
      };
    case "network":
      return { title: t.chat.errNetworkTitle, body: t.chat.errNetworkBody };
    case "server":
      return { title: t.chat.errServerTitle, body: error.message };
  }
}
