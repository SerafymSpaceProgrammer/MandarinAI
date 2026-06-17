import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { useTheme } from "@/theme";

type Props = {
  youtubeId: string;
  /** Aspect ratio width/height. YouTube videos are 16:9. */
  aspectRatio?: number;
  /** Fired ~4×/sec with the playhead time in seconds. */
  onTimeUpdate?: (t: number) => void;
  /** Fired when the iframe API reports state changes. */
  onPlayingChange?: (playing: boolean) => void;
};

export type YouTubePlayerHandle = {
  pause: () => void;
  play: () => void;
  /** Seek to a specific time in seconds (preserves play state). */
  seekTo: (t: number) => void;
};

/**
 * YouTube embed via WebView + iframe API. We host an inline HTML page that
 * loads the YouTube iframe API, instantiates a player, and uses
 * window.ReactNativeWebView.postMessage() to ship time + state updates back
 * to RN. Commands flow the other way through `webView.injectJavaScript`.
 *
 * Pure-JS approach — no extra native dep beyond react-native-webview, which
 * the project already has. Works in TestFlight binaries the same way it
 * works in Expo Go.
 */
export const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(
  function YouTubePlayer({ youtubeId, aspectRatio = 16 / 9, onTimeUpdate, onPlayingChange }, ref) {
    const theme = useTheme();
    const webRef = useRef<WebView>(null);

    useImperativeHandle(
      ref,
      () => ({
        pause: () => webRef.current?.injectJavaScript(`pausePlayer(); true;`),
        play: () => webRef.current?.injectJavaScript(`playPlayer(); true;`),
        seekTo: (t: number) =>
          webRef.current?.injectJavaScript(`seekPlayer(${t}); true;`),
      }),
      [],
    );

    function onMessage(e: WebViewMessageEvent) {
      try {
        const data = JSON.parse(e.nativeEvent.data) as
          | { type: "time"; t: number }
          | { type: "state"; playing: boolean };
        if (data.type === "time") onTimeUpdate?.(data.t);
        else if (data.type === "state") onPlayingChange?.(data.playing);
      } catch {
        // Ignore malformed messages — not worth surfacing to the user.
      }
    }

    return (
      <View
        style={{
          width: "100%",
          aspectRatio,
          borderRadius: theme.radii.md,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        <WebView
          ref={webRef}
          source={{ html: buildHtml(youtubeId) }}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          onMessage={onMessage}
          style={{ flex: 1, backgroundColor: "#000" }}
        />
      </View>
    );
  },
);

// HTML hosting the YouTube iframe API. We keep it as a tagged template so
// the videoId is interpolated at mount time; both `pausePlayer` and
// `seekPlayer` live on the global so injectJavaScript can call them.
function buildHtml(videoId: string): string {
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    #player { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var player = null;
    var timer = null;

    function send(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function startTicker() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        if (!player || !player.getCurrentTime) return;
        try {
          var t = player.getCurrentTime();
          if (typeof t === "number" && !Number.isNaN(t)) {
            send({ type: "time", t: t });
          }
        } catch (e) {}
      }, 250);
    }

    function pausePlayer() {
      try { player && player.pauseVideo && player.pauseVideo(); } catch (e) {}
    }
    function playPlayer() {
      try { player && player.playVideo && player.playVideo(); } catch (e) {}
    }
    function seekPlayer(t) {
      try { player && player.seekTo && player.seekTo(t, true); } catch (e) {}
    }

    function onYouTubeIframeAPIReady() {
      player = new YT.Player("player", {
        videoId: ${JSON.stringify(videoId)},
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: function () {
            startTicker();
          },
          onStateChange: function (e) {
            // 1 = playing, 2 = paused, 0 = ended, 3 = buffering
            if (e.data === 1) send({ type: "state", playing: true });
            else if (e.data === 2 || e.data === 0) send({ type: "state", playing: false });
          },
        },
      });
    }

    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  </script>
</body>
</html>
`;
}
