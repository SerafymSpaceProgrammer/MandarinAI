import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Pressable, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Lightbulb, RotateCcw } from "lucide-react-native";

import { Text } from "@/components/ui";
import { useT } from "@/i18n/i18n";
import { fmt } from "@/i18n/strings";
import { logger } from "@/lib/logger";
import { useTheme } from "@/theme";

type Props = {
  hanzi: string;
  /** Render size in screen points. Defaults to 300×300. */
  size?: number;
  /**
   * Called once the user finishes drawing every stroke. `mistakes` counts the
   * total wrong attempts across the whole character. The hint button bumps
   * the count too — that's intentional, since the user got an assist.
   */
  onComplete: (info: { mistakes: number; totalStrokes: number }) => void;
  /** Fired any time hanzi-writer can't render the character (no data, etc.). */
  onUnavailable?: (message: string) => void;
  /**
   * Live progress updates so a parent can render its own chrome (stroke
   * counter, per-stroke chips, mistake tally). Fires on every state change.
   */
  onProgress?: (info: {
    strokesDrawn: number;
    totalStrokes: number;
    mistakes: number;
    done: boolean;
    ready: boolean;
  }) => void;
  /**
   * Hide the built-in progress text + hint/restart buttons + bordered box.
   * The parent owns the surrounding UI (used by the redesigned Write step,
   * which wraps the bare canvas in a paper card with its own controls).
   */
  chromeless?: boolean;
  /** Canvas background passed to the HTML body. "transparent" lets a grid
   *  drawn behind the WebView show through. Defaults to theme surface. */
  canvasBg?: string;
  /** Draw a faint mi-zi-ge (米字格) guide grid behind the character. */
  showGrid?: boolean;
};

export type StrokeQuizHandle = {
  /** Reset progress and start the quiz over for the same character. */
  restart: () => void;
  /** Animate the next expected stroke as a hint (counts as a mistake). */
  hint: () => void;
};

/**
 * Trace-the-strokes practice using hanzi-writer's quiz API inside a WebView.
 *
 * Why a WebView: hanzi-writer ships its own pointer-event handlers attached
 * to the SVG canvas. Re-implementing the matching logic on top of Skia would
 * be substantial work — and offers no obvious win — so we let the proven JS
 * version do the heavy lifting and just relay events back to RN.
 */
export const StrokeQuiz = forwardRef<StrokeQuizHandle, Props>(function StrokeQuiz(
  {
    hanzi,
    size = 300,
    onComplete,
    onUnavailable,
    onProgress,
    chromeless = false,
    canvasBg,
    showGrid = false,
  },
  ref,
) {
  const theme = useTheme();
  const t = useT();
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [strokesDrawn, setStrokesDrawn] = useState(0);
  const [strokeCount, setStrokeCount] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  // Keep the latest onProgress in a ref so the emit effect doesn't re-fire
  // just because the parent passed a fresh inline callback.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  useEffect(() => {
    onProgressRef.current?.({
      strokesDrawn,
      totalStrokes: strokeCount ?? 0,
      mistakes,
      done,
      ready,
    });
  }, [strokesDrawn, strokeCount, mistakes, done, ready]);

  const html = buildQuizHtml({
    hanzi,
    bg: canvasBg ?? theme.colors.surface,
    stroke: theme.colors.textPrimary,
    radical: theme.colors.accent,
    outline: theme.colors.border,
    highlight: theme.colors.accent,
    mistake: theme.colors.danger,
    drawing: theme.colors.accent,
    showGrid,
    gridColor: "#F1C7CB",
  });

  function send(command: "restart" | "hint") {
    webviewRef.current?.injectJavaScript(`window._hwq_${command}?.(); true;`);
  }

  useImperativeHandle(ref, () => ({
    restart: () => {
      setStrokesDrawn(0);
      setMistakes(0);
      setDone(false);
      send("restart");
    },
    hint: () => send("hint"),
  }));

  function onMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data) as {
        type: string;
        strokeCount?: number;
        strokeNum?: number;
        mistakesOnStroke?: number;
        totalMistakes?: number;
        message?: string;
      };
      if (data.type === "ready") {
        setReady(true);
        setStrokeCount(data.strokeCount ?? 0);
      } else if (data.type === "correct") {
        setStrokesDrawn(data.strokeNum != null ? data.strokeNum + 1 : (s) => s + 1);
      } else if (data.type === "mistake") {
        setMistakes(data.totalMistakes ?? mistakes + 1);
      } else if (data.type === "complete") {
        setDone(true);
        onComplete({
          mistakes: data.totalMistakes ?? 0,
          totalStrokes: strokeCount ?? 0,
        });
      } else if (data.type === "unavailable") {
        setReady(true);
        setStrokeCount(0);
        logger.warn("stroke quiz unavailable", hanzi, data.message);
        onUnavailable?.(data.message ?? "");
      }
    } catch {
      // ignore non-JSON
    }
  }

  const webview = (
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
  );

  // Chromeless: just the bare canvas. The parent (redesigned Write step)
  // renders its own paper card, stats row, stroke chips and controls and
  // drives hint/restart through the ref + progress through onProgress.
  if (chromeless) {
    return (
      <View style={{ width: size, height: size, overflow: "hidden" }}>
        {webview}
      </View>
    );
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
        {webview}
      </View>

      <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
        {strokeCount !== null && strokeCount > 0 ? (
          <Text variant="small" color={done ? "success" : "secondary"}>
            {done
              ? t.writing.allStrokesDone
              : fmt(t.writing.progress, { drawn: strokesDrawn, total: strokeCount })}
          </Text>
        ) : strokeCount === 0 ? (
          <Text variant="small" color="tertiary">
            {t.strokes.unavailable}
          </Text>
        ) : (
          <Text variant="small" color="tertiary">
            {t.common.loading}
          </Text>
        )}
        {mistakes > 0 ? (
          <Text variant="caption" color="tertiary">
            {fmt(mistakes === 1 ? t.writing.mistakesOne : t.writing.mistakesOther, {
              n: mistakes,
            })}
          </Text>
        ) : null}

        {ready && strokeCount && strokeCount > 0 && !done ? (
          <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
            <IconBtn
              Icon={Lightbulb}
              accessibilityLabel={t.writing.hint}
              onPress={() => send("hint")}
            />
            <IconBtn
              Icon={RotateCcw}
              accessibilityLabel={t.writing.restart}
              onPress={() => {
                setStrokesDrawn(0);
                setMistakes(0);
                setDone(false);
                send("restart");
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});

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
 * Bare-bones HTML page that hosts a hanzi-writer quiz. Touches go straight
 * to the SVG; we relay each meaningful event (correct stroke, mistake, full
 * completion, hint) back to RN via postMessage.
 */
function buildQuizHtml(opts: {
  hanzi: string;
  bg: string;
  stroke: string;
  radical: string;
  outline: string;
  highlight: string;
  mistake: string;
  drawing: string;
  showGrid?: boolean;
  gridColor?: string;
}): string {
  const {
    hanzi,
    bg,
    stroke,
    radical,
    outline,
    highlight,
    mistake,
    drawing,
    showGrid = false,
    gridColor = "#F1C7CB",
  } = opts;
  // mi-zi-ge (米字格): outer square + center cross + both diagonals, dashed.
  // Drawn as an SVG that exactly overlays the hanzi-writer target so the
  // guide lines stay aligned with the character at any size.
  const gridSvg = showGrid
    ? `<svg id="grid" viewBox="0 0 100 100" preserveAspectRatio="none"
         style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
         <rect x="1.5" y="1.5" width="97" height="97" fill="none"
               stroke="${gridColor}" stroke-width="0.6" stroke-dasharray="2 2"/>
         <line x1="50" y1="0" x2="50" y2="100" stroke="${gridColor}" stroke-width="0.6" stroke-dasharray="2 2"/>
         <line x1="0" y1="50" x2="100" y2="50" stroke="${gridColor}" stroke-width="0.6" stroke-dasharray="2 2"/>
         <line x1="0" y1="0" x2="100" y2="100" stroke="${gridColor}" stroke-width="0.6" stroke-dasharray="2 2"/>
         <line x1="100" y1="0" x2="0" y2="100" stroke="${gridColor}" stroke-width="0.6" stroke-dasharray="2 2"/>
       </svg>`
    : "";
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
      touch-action: none;
    }
    #stage { position: relative; width: 92%; height: 92%; touch-action: none; }
    #target { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
    #target svg { touch-action: none; }
  </style>
</head>
<body>
  <div id="stage">
    ${gridSvg}
    <div id="target"></div>
  </div>
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
            showHintAfterMisses: 3,
            highlightOnComplete: true,
            strokeColor: ${JSON.stringify(stroke)},
            radicalColor: ${JSON.stringify(radical)},
            outlineColor: ${JSON.stringify(outline)},
            highlightColor: ${JSON.stringify(highlight)},
            drawingColor: ${JSON.stringify(drawing)},
            drawingWidth: 24,
            onLoadCharDataSuccess: function (data) {
              var count = (data && data.strokes) ? data.strokes.length : 0;
              post({ type: 'ready', strokeCount: count });
              startQuiz();
            },
            onLoadCharDataError: function (err) {
              post({ type: 'unavailable', message: 'char data error: ' + (err && err.message ? err.message : 'not found') });
            }
          });
        } catch (err) {
          post({ type: 'unavailable', message: 'create error: ' + (err.message || err) });
          return;
        }

        // Track the index of the next stroke the quiz expects so the hint
        // button can highlight it. hanzi-writer does not expose this through
        // its public API, but each onCorrectStroke gives us the index just
        // completed — so the next one is data.strokeNum + 1.
        var currentStroke = 0;

        function startQuiz() {
          currentStroke = 0;
          try {
            writer.quiz({
              leniency: 1.2,
              showHintAfterMisses: 3,
              onCorrectStroke: function (data) {
                currentStroke = (data.strokeNum ?? -1) + 1;
                post({
                  type: 'correct',
                  strokeNum: data.strokeNum,
                  mistakesOnStroke: data.mistakesOnStroke,
                  totalMistakes: data.totalMistakes
                });
              },
              onMistake: function (data) {
                post({
                  type: 'mistake',
                  strokeNum: data.strokeNum,
                  mistakesOnStroke: data.mistakesOnStroke,
                  totalMistakes: data.totalMistakes
                });
              },
              onComplete: function (data) {
                post({ type: 'complete', totalMistakes: data.totalMistakes });
              }
            });
          } catch (err) {
            post({ type: 'unavailable', message: 'quiz error: ' + (err.message || err) });
          }
        }

        window._hwq_restart = function () {
          try { writer.cancelQuiz && writer.cancelQuiz(); } catch (e) {}
          try { writer.hideCharacter && writer.hideCharacter(); } catch (e) {}
          setTimeout(startQuiz, 80);
        };

        window._hwq_hint = function () {
          // Briefly flash the next expected stroke. highlightStroke is the
          // safest API while a quiz is running — it draws over the canvas
          // without disturbing quiz internals.
          try {
            if (typeof writer.highlightStroke === 'function') {
              writer.highlightStroke(currentStroke);
            }
          } catch (e) {}
        };
      }

      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start);
    })();
  </script>
</body>
</html>`;
}
