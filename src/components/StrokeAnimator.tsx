import { Pause, Play, RotateCcw } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, View } from "react-native";
import Svg, { ClipPath, Defs, G, Path } from "react-native-svg";

import { Text } from "@/components/ui";
import {
  fetchStrokeData,
  medianLength,
  medianToPathD,
  type StrokeData,
} from "@/features/strokes/api";
import { useTheme } from "@/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// hanzi-writer-data uses a 1024-box with y axis inverted relative to SVG.
const VIEWBOX = "0 0 1024 1024";
const Y_FLIP = "matrix(1 0 0 -1 0 900)";
// Width of the reveal brush in viewBox units. Wider than any real stroke so
// the clip fully uncovers it.
const REVEAL_WIDTH = 260;
const MS_PER_STROKE = 650;
const GAP_MS = 180;

type Props = {
  hanzi: string;
  /** Render size in screen points. Defaults to 260×260. */
  size?: number;
  /** Show outline of every stroke in muted color. Default true. */
  showOutline?: boolean;
  /** Autoplay the animation on mount. Default true. */
  autoplay?: boolean;
  /** Paint radical strokes in the accent color. Default true. */
  highlightRadical?: boolean;
};

type Status = "loading" | "ready" | "unavailable";

export function StrokeAnimator({
  hanzi,
  size = 260,
  showOutline = true,
  autoplay = true,
  highlightRadical = true,
}: Props) {
  const theme = useTheme();

  const [data, setData] = useState<StrokeData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setData(null);
    setActiveIdx(-1);
    (async () => {
      const result = await fetchStrokeData(hanzi);
      if (cancelled) return;
      if (!result) {
        setStatus("unavailable");
      } else {
        setData(result);
        setStatus("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hanzi]);

  const lengths = useMemo(() => (data ? data.medians.map((m) => medianLength(m)) : []), [data]);

  // One Animated.Value per stroke, stable across renders for this hanzi.
  const offsetsRef = useRef<Animated.Value[]>([]);
  useEffect(() => {
    if (!data) return;
    offsetsRef.current = data.medians.map((_, i) => new Animated.Value(lengths[i] ?? 1));
    // Restart activeIdx when a new character loads.
    setActiveIdx(-1);
  }, [data, lengths]);

  // The running sequence so we can stop it.
  const runningSeq = useRef<Animated.CompositeAnimation | null>(null);

  function stop() {
    runningSeq.current?.stop();
    runningSeq.current = null;
    setPlaying(false);
  }

  function reset() {
    stop();
    if (!data) return;
    data.medians.forEach((_, i) => {
      offsetsRef.current[i]?.setValue(lengths[i] ?? 1);
    });
    setActiveIdx(-1);
  }

  function play() {
    if (!data || data.strokes.length === 0) return;
    stop();
    reset();

    const anims: Animated.CompositeAnimation[] = [];
    data.strokes.forEach((_, i) => {
      const offset = offsetsRef.current[i];
      if (!offset) return;
      anims.push(
        Animated.sequence([
          Animated.delay(i === 0 ? 0 : GAP_MS),
          // Mark active BEFORE the stroke animation starts by using a 1ms delay
          // paired with a listener-style trick via a zero-duration timing on a
          // scratch value. Simpler: a parallel update via a callback in onStart.
          Animated.timing(offset, {
            toValue: 0,
            duration: MS_PER_STROKE,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
    });

    const seq = Animated.sequence(anims);
    runningSeq.current = seq;
    setPlaying(true);
    setActiveIdx(0);

    // Best-effort active-index tracking. After each stroke finishes, advance.
    let cumulative = 0;
    data.strokes.forEach((_, i) => {
      cumulative += (i === 0 ? 0 : GAP_MS) + MS_PER_STROKE;
      setTimeout(() => {
        if (runningSeq.current !== seq) return;
        if (i + 1 < data.strokes.length) {
          setActiveIdx(i + 1);
        } else {
          setActiveIdx(-1);
          setPlaying(false);
        }
      }, cumulative);
    });

    seq.start(({ finished }) => {
      if (!finished) return;
      if (runningSeq.current === seq) {
        runningSeq.current = null;
      }
    });
  }

  // Autoplay once the character's strokes are loaded.
  useEffect(() => {
    if (status !== "ready" || !autoplay) return;
    const id = setTimeout(play, 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hanzi, autoplay]);

  // Stop any in-flight animation on unmount.
  useEffect(() => () => stop(), []);

  const radicalSet = useMemo(
    () => new Set(data?.radStrokes ?? []),
    [data],
  );

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
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
        }}
      >
        {status === "loading" ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : status === "unavailable" || !data ? (
          <View style={{ alignItems: "center", gap: 4, paddingHorizontal: 12 }}>
            <Text chinese style={{ fontSize: 96, lineHeight: 104, color: theme.colors.textPrimary }}>
              {hanzi}
            </Text>
            <Text variant="small" color="tertiary" align="center">
              Stroke data unavailable for this character.
            </Text>
          </View>
        ) : (
          <Svg width={size - 8} height={size - 8} viewBox={VIEWBOX}>
            <Defs>
              {data.medians.map((m, i) => {
                const offset = offsetsRef.current[i];
                if (!offset) return null;
                return (
                  <ClipPath key={`clip-${i}`} id={`cl-${hanzi}-${i}`}>
                    <AnimatedPath
                      d={medianToPathD(m)}
                      stroke="#000"
                      strokeWidth={REVEAL_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      strokeDasharray={lengths[i] ?? 1}
                      strokeDashoffset={offset}
                    />
                  </ClipPath>
                );
              })}
            </Defs>

            <G transform={Y_FLIP}>
              {/* Faint outlines */}
              {showOutline
                ? data.strokes.map((d, i) => (
                    <Path
                      key={`outline-${i}`}
                      d={d}
                      fill="none"
                      stroke={theme.colors.border}
                      strokeWidth={2}
                    />
                  ))
                : null}
              {/* Filled strokes, revealed through the animated clip */}
              {data.strokes.map((d, i) => {
                const isActive = i === activeIdx;
                const isRadical = highlightRadical && radicalSet.has(i);
                const fill = isActive
                  ? theme.colors.accent
                  : isRadical
                    ? theme.colors.accent
                    : theme.colors.textPrimary;
                return (
                  <Path
                    key={`fill-${i}`}
                    d={d}
                    fill={fill}
                    clipPath={`url(#cl-${hanzi}-${i})`}
                  />
                );
              })}
            </G>
          </Svg>
        )}
      </View>

      {status === "ready" && data ? (
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Text variant="small" color="tertiary">
            {data.strokes.length} {data.strokes.length === 1 ? "stroke" : "strokes"}
            {activeIdx >= 0 ? ` · drawing ${activeIdx + 1}/${data.strokes.length}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
            <IconBtn
              accessibilityLabel={playing ? "Pause" : "Play"}
              onPress={() => (playing ? stop() : play())}
              Icon={playing ? Pause : Play}
            />
            <IconBtn
              accessibilityLabel="Restart"
              onPress={() => {
                reset();
                setTimeout(play, 80);
              }}
              Icon={RotateCcw}
            />
          </View>
        </View>
      ) : null}
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
