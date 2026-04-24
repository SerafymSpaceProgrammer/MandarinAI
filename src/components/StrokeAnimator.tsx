import { Pause, Play, RotateCcw } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { Text } from "@/components/ui";
import { useTheme } from "@/theme";

type Props = {
  hanzi: string;
  /** Render size in screen points. Defaults to 260×260. */
  size?: number;
  /** Autoplay the animation once the page loads. Default true. */
  autoplay?: boolean;
};

/**
 * Embeds hanzi-writer (the same library used by the ChineseLens extension)
 * inside a WebView. This is by far the most reliable way to get the smooth,
 * crisp stroke-order animation across Android/iOS — react-native-svg's
 * clip-path rendering is too buggy for the required reveal effect, so we
 * let the battle-tested web implementation do the drawing.
 */
export function StrokeAnimator({ hanzi, size = 260, autoplay = true }: Props) {
  const theme = useTheme();
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [strokeCount, setStrokeCount] = useState<number | null>(null);
  const [currentStroke, setCurrentStroke] = useState<number | null>(null);

  const html = buildHtml({
    hanzi,
    bg: theme.colors.surface,
    stroke: theme.colors.textPrimary,
    radical: theme.colors.accent,
    outline: theme.colors.border,
    autoplay,
  });

  function send(command: "play" | "pause" | "reset") {
    webviewRef.current?.injectJavaScript(`window._hw_${command}?.(); true;`);
  }

  function onMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data) as {
        type: string;
        strokeCount?: number;
        index?: number;
      };
      if (data.type === "ready") {
        setReady(true);
        if (data.strokeCount != null) setStrokeCount(data.strokeCount);
      } else if (data.type === "start") {
        setPlaying(true);
        setCurrentStroke(data.index ?? 0);
      } else if (data.type === "stroke") {
        setCurrentStroke(data.index ?? null);
      } else if (data.type === "end") {
        setPlaying(false);
        setCurrentStroke(null);
      } else if (data.type === "unavailable") {
        setReady(true);
        setStrokeCount(0);
      }
    } catch {
      // ignore non-JSON messages
    }
  }

  return (
    <View style={{ alignItems: "center", gap: theme.spacing.md }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: "hidden",
        }}
      >
        <WebView
          ref={webviewRef}
          source={{ html }}
          originWhitelist={["*"]}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          androidLayerType="hardware"
          // Transparent so the outer View's background (theme surface) shows through
          // while fonts/data are loading — avoids a flash of white on dark themes.
          style={{ backgroundColor: "transparent", width: size, height: size }}
        />
      </View>

      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
        {strokeCount !== null && strokeCount > 0 ? (
          <Text variant="small" color="tertiary">
            {strokeCount} {strokeCount === 1 ? "stroke" : "strokes"}
            {currentStroke !== null ? ` · drawing ${currentStroke + 1}/${strokeCount}` : ""}
          </Text>
        ) : strokeCount === 0 ? (
          <Text variant="small" color="tertiary">
            Stroke data unavailable
          </Text>
        ) : (
          <Text variant="small" color="tertiary">
            Loading…
          </Text>
        )}
        {ready && strokeCount && strokeCount > 0 ? (
          <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
            <IconBtn
              Icon={playing ? Pause : Play}
              accessibilityLabel={playing ? "Pause" : "Play"}
              onPress={() => send(playing ? "pause" : "play")}
            />
            <IconBtn
              Icon={RotateCcw}
              accessibilityLabel="Restart"
              onPress={() => send("reset")}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function IconBtn({
  Icon,
  onPress,
  accessibilityLabel,
}: {
  Icon: React.ComponentType<{ color: string; size?: number; strokeWidth?: number }>;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon color={theme.colors.accent} size={22} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * Produce a self-contained HTML document that:
 *  • loads hanzi-writer (same version family as the extension — 3.7.x)
 *  • draws the given character with the app's theme colors
 *  • posts start/stroke/end events back to RN so we can drive the counter
 *  • exposes window._hw_play / _hw_pause / _hw_reset for the RN controls
 */
function buildHtml(opts: {
  hanzi: string;
  bg: string;
  stroke: string;
  radical: string;
  outline: string;
  autoplay: boolean;
}): string {
  const { hanzi, bg, stroke, radical, outline, autoplay } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: ${bg};
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    #target {
      width: 92%;
      height: 92%;
    }
  </style>
</head>
<body>
  <div id="target"></div>
  <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"></script>
  <script>
    (function () {
      function post(payload) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } catch (e) { /* noop */ }
      }

      function start() {
        var el = document.getElementById('target');
        if (!el || typeof HanziWriter === 'undefined') {
          post({ type: 'unavailable' });
          return;
        }

        var rect = el.getBoundingClientRect();
        var side = Math.min(rect.width, rect.height);

        try {
          var writer = HanziWriter.create('target', ${JSON.stringify(hanzi)}, {
            width: side,
            height: side,
            padding: 6,
            showOutline: true,
            showCharacter: false,
            strokeColor: ${JSON.stringify(stroke)},
            radicalColor: ${JSON.stringify(radical)},
            outlineColor: ${JSON.stringify(outline)},
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 220,
            strokeFadeDuration: 280
          });

          // The library loads stroke data async from a CDN. Start animating
          // once loaded so the UI feels instant. Errors here usually mean the
          // character isn't in the dataset.
          writer.loadCharacterData(${JSON.stringify(hanzi)}).then(function (data) {
            var strokeCount = (data && data.strokes) ? data.strokes.length : 0;
            post({ type: 'ready', strokeCount: strokeCount });
            if (${autoplay ? "true" : "false"}) runAnimation();
          }).catch(function () {
            post({ type: 'unavailable' });
          });

          function runAnimation() {
            post({ type: 'start', index: 0 });
            writer.animateCharacter({
              onAnimationComplete: function () {
                post({ type: 'end' });
              }
            });
            // hanzi-writer doesn't emit per-stroke events directly, so we use
            // the plugin-less approach: intercept animateStroke and ping RN
            // whenever the library kicks off the next stroke.
          }

          // Monkey-patch the per-stroke animator to emit progress.
          var origAnimate = writer._renderState && writer._renderState.state
            ? null
            : null;

          // hanzi-writer 3.x exposes an animateCharacter that internally calls
          // animateStroke in sequence. We subscribe via the _characterRenderer
          // if available, else use a fallback timer that polls isAnimating.
          try {
            var orig = writer.animateStroke.bind(writer);
            writer.animateStroke = function (idx, opt) {
              post({ type: 'stroke', index: idx });
              return orig(idx, opt);
            };
          } catch (e) { /* old hanzi-writer API */ }

          window._hw_play = function () { writer.animateCharacter({ onAnimationComplete: function () { post({ type: 'end' }); } }); post({ type: 'start', index: 0 }); };
          window._hw_pause = function () { try { writer.pauseAnimation && writer.pauseAnimation(); } catch (e) {} post({ type: 'end' }); };
          window._hw_reset = function () {
            try { writer.cancelAnimation && writer.cancelAnimation(); } catch (e) {}
            try { writer.hideCharacter(); } catch (e) {}
            post({ type: 'end' });
            setTimeout(function () {
              post({ type: 'start', index: 0 });
              writer.animateCharacter({ onAnimationComplete: function () { post({ type: 'end' }); } });
            }, 80);
          };
        } catch (err) {
          post({ type: 'unavailable' });
        }
      }

      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start);
    })();
  </script>
</body>
</html>`;
}
