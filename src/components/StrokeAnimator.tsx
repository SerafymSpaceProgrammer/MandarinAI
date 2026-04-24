import { Pause, Play, RotateCcw } from "lucide-react-native";
import { memo, useEffect, useMemo, useRef, useState } from "react";
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

// hanzi-writer-data is authored in a 1024-wide coordinate system with the
// origin bottom-left (y grows up). To render in SVG (origin top-left, y grows
// down) we flip y and translate by the full height. Using 900 here — which I
// did earlier — clips any stroke between y=900 and y=1024.
const VIEWBOX = "0 0 1024 1024";
const Y_FLIP = "matrix(1 0 0 -1 0 1024)";
// Width of the reveal brush in viewBox units. Must exceed the thickest real
// stroke so the median-sweep clip fully uncovers it.
const REVEAL_WIDTH = 320;
const MS_PER_STROKE = 600;
const GAP_MS = 160;

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

  // Generation counter — every play/reset bumps this. Any in-flight callback
  // that sees a stale generation bails out, so there's no way for an old
  // sequence to keep driving state after stop() or a new play() takes over.
  const genRef = useRef(0);
  const runningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningAnim = useRef<Animated.CompositeAnimation | null>(null);

  function stop() {
    genRef.current += 1;
    runningAnim.current?.stop();
    runningAnim.current = null;
    if (runningTimer.current != null) {
      clearTimeout(runningTimer.current);
      runningTimer.current = null;
    }
    setPlaying(false);
    setActiveIdx(-1);
  }

  function reset() {
    stop();
    if (!data) return;
    data.medians.forEach((_, i) => {
      offsetsRef.current[i]?.setValue(lengths[i] ?? 1);
    });
  }

  function play() {
    if (!data || data.strokes.length === 0) return;
    reset();

    genRef.current += 1;
    const gen = genRef.current;
    setPlaying(true);

    const step = (i: number) => {
      if (gen !== genRef.current) return;
      if (i >= data.strokes.length) {
        setActiveIdx(-1);
        setPlaying(false);
        return;
      }
      setActiveIdx(i);
      const offset = offsetsRef.current[i];
      if (!offset) {
        step(i + 1);
        return;
      }
      const anim = Animated.timing(offset, {
        toValue: 0,
        duration: MS_PER_STROKE,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      });
      runningAnim.current = anim;
      anim.start(({ finished }) => {
        if (gen !== genRef.current) return;
        if (!finished) return;
        runningAnim.current = null;
        runningTimer.current = setTimeout(() => {
          runningTimer.current = null;
          step(i + 1);
        }, GAP_MS);
      });
    };

    step(0);
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
          <GlyphSvg
            hanzi={hanzi}
            data={data}
            offsets={offsetsRef.current}
            lengths={lengths}
            radicals={radicalSet}
            size={size - 8}
            showOutline={showOutline}
            highlightRadical={highlightRadical}
            outlineColor={theme.colors.border}
            fillColor={theme.colors.textPrimary}
            accent={theme.colors.accent}
          />
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

// Memoized SVG shell. Props are stable for the duration of any single
// character's animation (offsets are Animated.Value refs that don't change
// identity, lengths are stable once data loads), so React skips re-rendering
// it when the outer component updates the play/counter state.
type GlyphSvgProps = {
  hanzi: string;
  data: StrokeData;
  offsets: Animated.Value[];
  lengths: number[];
  radicals: Set<number>;
  size: number;
  showOutline: boolean;
  highlightRadical: boolean;
  outlineColor: string;
  fillColor: string;
  accent: string;
};

const GlyphSvg = memo(function GlyphSvg({
  hanzi,
  data,
  offsets,
  lengths,
  radicals,
  size,
  showOutline,
  highlightRadical,
  outlineColor,
  fillColor,
  accent,
}: GlyphSvgProps) {
  return (
    <Svg width={size} height={size} viewBox={VIEWBOX}>
      <Defs>
        {data.medians.map((m, i) => {
          const offset = offsets[i];
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
        {showOutline
          ? data.strokes.map((d, i) => (
              <Path
                key={`outline-${i}`}
                d={d}
                fill="none"
                stroke={outlineColor}
                strokeWidth={2}
              />
            ))
          : null}
        {data.strokes.map((d, i) => {
          const isRadical = highlightRadical && radicals.has(i);
          return (
            <Path
              key={`fill-${i}`}
              d={d}
              fill={isRadical ? accent : fillColor}
              clipPath={`url(#cl-${hanzi}-${i})`}
            />
          );
        })}
      </G>
    </Svg>
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
