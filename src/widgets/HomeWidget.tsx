import { FlexWidget, TextWidget } from "react-native-android-widget";

/**
 * The Android home-screen widget. Renders three quick stats — streak, due
 * cards, word of the day — that the user typically opens the app to check.
 *
 * Layout is FlexWidget (the only RN-like primitive the library exposes for
 * Android RemoteViews). It compiles down to a static layout each refresh —
 * no event handlers, no animations, no images beyond the brand square.
 */
export type WidgetData = {
  streak: number;
  dueCount: number;
  wordHanzi: string | null;
  wordPinyin: string | null;
  wordMeaning: string | null;
  greeting: string;
};

const ACCENT = "#E63946";
const ACCENT_SOFT = "#FCE8EA";
const BG = "#FFFFFF";
const INK = "#0F172A";
const INK_MUTED = "#6B7280";
const BORDER = "#E5E7EB";

export function HomeWidget({ data }: { data: WidgetData }) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: BG,
        borderRadius: 24,
        padding: 14,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      // Tapping anywhere on the widget body opens the app at root.
      clickAction="OPEN_APP"
    >
      {/* Header: 中-square + greeting + streak chip */}
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "match_parent",
        }}
      >
        <FlexWidget
          style={{
            width: 32,
            height: 32,
            backgroundColor: ACCENT,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <TextWidget
            text="中"
            style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}
          />
        </FlexWidget>

        <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
          <TextWidget
            text={data.greeting.toUpperCase()}
            style={{ fontSize: 9, color: ACCENT, fontWeight: "700" }}
          />
          <TextWidget
            text="MandarinAI"
            style={{ fontSize: 14, color: INK, fontWeight: "700" }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: data.streak > 0 ? ACCENT_SOFT : "#F5F5F5",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <TextWidget text="🔥" style={{ fontSize: 12 }} />
          <TextWidget
            text={` ${data.streak}`}
            style={{
              fontSize: 13,
              color: data.streak > 0 ? ACCENT : INK_MUTED,
              fontWeight: "700",
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Middle: word of the day OR placeholder */}
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "match_parent",
          paddingVertical: 8,
        }}
      >
        {data.wordHanzi ? (
          <FlexWidget style={{ flexDirection: "column", flex: 1 }}>
            <TextWidget
              text={data.wordHanzi}
              style={{ fontSize: 24, color: INK, fontWeight: "700" }}
            />
            {data.wordPinyin ? (
              <TextWidget
                text={data.wordPinyin}
                style={{ fontSize: 11, color: ACCENT }}
              />
            ) : null}
            {data.wordMeaning ? (
              <TextWidget
                text={data.wordMeaning}
                style={{ fontSize: 11, color: INK_MUTED }}
                maxLines={1}
              />
            ) : null}
          </FlexWidget>
        ) : (
          <TextWidget
            text="Tap to start your first session →"
            style={{ fontSize: 12, color: INK_MUTED }}
          />
        )}
      </FlexWidget>

      {/* Footer: due chip */}
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "match_parent",
          borderTopWidth: 1,
          borderTopColor: BORDER,
          paddingTop: 8,
        }}
      >
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={
              data.dueCount > 0
                ? `${data.dueCount} due for review`
                : "All caught up"
            }
            style={{
              fontSize: 12,
              color: data.dueCount > 0 ? ACCENT : INK_MUTED,
              fontWeight: data.dueCount > 0 ? "700" : "400",
            }}
          />
        </FlexWidget>
        <TextWidget text="→" style={{ fontSize: 14, color: ACCENT, fontWeight: "700" }} />
      </FlexWidget>
    </FlexWidget>
  );
}
