import { Pause, Play, RotateCcw } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { Text } from "@/components/ui";
import { logger } from "@/lib/logger";
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
 * inside a WebView. This is the most reliable way to get smooth, crisp
 * stroke-order animation across iOS/Android — react-native-svg's clip-path
 * rendering is too buggy for the required reveal effect, so we let the
 * battle-tested web implementation do the drawing.
 */
export function StrokeAnimator({ hanzi, size = 260, autoplay = true }: Props) {
  const theme = useTheme();
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [strokeCount, setStrokeCount] = useState<number | null>(null);
  const [currentStroke, setCurrentStroke] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        message?: string;
      };
      if (data.type === "ready") {
        setReady(true);
        setErrorMessage(null);
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
        setErrorMessage(data.message ?? "Stroke data unavailable");
        logger.warn("stroke animator unavailable", hanzi, data.message);
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
          source={{ html, baseUrl: "https://cdn.jsdelivr.net/" }}
          originWhitelist={["*"]}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          androidLayerType="hardware"
          mixedContentMode="always"
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
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text variant="small" color="tertiary">
              Stroke data unavailable
            </Text>
            {errorMessage ? (
              <Text variant="caption" color="tertiary">
                ({errorMessage})
              </Text>
            ) : null}
          </View>
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
 * Self-contained HTML that loads hanzi-writer and uses its built-in data
 * loader (CDN-fed) with onLoadCharDataSuccess / onLoadCharDataError so we
 * don't need to call a non-existent instance method. postMessage relays
 * ready / start / stroke / end / unavailable events back to RN.
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
  <script>
    function post(payload) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (e) {}
    }
    window.addEventListener('error', function (ev) {
      post({ type: 'unavailable', message: 'js error: ' + (ev.message || 'unknown') });
    });
  </script>
  <script
    src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"
    onerror="post({ type: 'unavailable', message: 'script load failed' })"
  ></script>
  <script>
    (function () {
      function start() {
        if (typeof HanziWriter === 'undefined') {
          post({ type: 'unavailable', message: 'HanziWriter not defined' });
          return;
        }

        var el = document.getElementById('target');
        if (!el) { post({ type: 'unavailable', message: 'no target element' }); return; }

        var rect = el.getBoundingClientRect();
        var side = Math.max(80, Math.min(rect.width, rect.height));

        var writer;
        try {
          writer = HanziWriter.create('target', ${JSON.stringify(hanzi)}, {
            width: side,
            height: side,
            padding: 6,
            showOutline: true,
            showCharacter: false,
            strokeColor: ${JSON.stringify(stroke)},
            radicalColor: ${JSON.stringify(radical)},
            outlineColor: ${JSON.stringify(outline)},
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 200,
            strokeFadeDuration: 280,
            onLoadCharDataSuccess: function (data) {
              var count = (data && data.strokes) ? data.strokes.length : 0;
              post({ type: 'ready', strokeCount: count });
              if (${autoplay ? "true" : "false"}) {
                setTimeout(function () { runAnimation(); }, 60);
              }
            },
            onLoadCharDataError: function (err) {
              post({ type: 'unavailable', message: 'char data error: ' + (err && err.message ? err.message : 'not found') });
            }
          });
        } catch (err) {
          post({ type: 'unavailable', message: 'create error: ' + (err.message || err) });
          return;
        }

        // Emit per-stroke progress by monkey-patching animateStroke.
        try {
          var origAnimate = writer.animateStroke.bind(writer);
          writer.animateStroke = function (idx, opts) {
            post({ type: 'stroke', index: idx });
            return origAnimate(idx, opts);
          };
        } catch (e) { /* older hanzi-writer API */ }

        function runAnimation() {
          post({ type: 'start', index: 0 });
          writer.animateCharacter({
            onComplete: function () { post({ type: 'end' }); }
          });
        }

        window._hw_play = function () { runAnimation(); };
        window._hw_pause = function () {
          try { writer.pauseAnimation && writer.pauseAnimation(); } catch (e) {}
          post({ type: 'end' });
        };
        window._hw_reset = function () {
          try { writer.cancelAnimation && writer.cancelAnimation(); } catch (e) {}
          try { writer.hideCharacter && writer.hideCharacter(); } catch (e) {}
          post({ type: 'end' });
          setTimeout(runAnimation, 120);
        };
      }

      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start);
    })();
  </script>
</body>
</html>`;
}
