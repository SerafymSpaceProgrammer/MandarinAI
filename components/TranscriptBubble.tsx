import { View, Text } from "react-native";
import type { TranscriptLine } from "../types";

interface Props {
  line: TranscriptLine;
  showTranslation?: boolean;
}

export function TranscriptBubble({ line, showTranslation = false }: Props) {
  const isUser = line.role === "user";

  return (
    <View
      className={`mb-3 max-w-xs ${isUser ? "self-end items-end" : "self-start items-start"}`}
    >
      <View
        className={`rounded-2xl px-4 py-3 ${
          isUser ? "bg-accent rounded-tr-sm" : "bg-gray-100 rounded-tl-sm"
        }`}
      >
        <Text
          className={`text-lg leading-tight ${isUser ? "text-white" : "text-gray-900"}`}
        >
          {line.hanzi}
        </Text>
        {line.pinyin ? (
          <Text
            className={`text-xs mt-1 ${isUser ? "text-red-100" : "text-gray-500"}`}
          >
            {line.pinyin}
          </Text>
        ) : null}
        {showTranslation && line.english ? (
          <Text
            className={`text-xs mt-0.5 italic ${
              isUser ? "text-red-100" : "text-gray-400"
            }`}
          >
            {line.english}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
