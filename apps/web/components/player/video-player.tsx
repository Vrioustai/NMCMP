"use client";

import type { PlaybackInfo } from "@movie/contracts";
import type { ErrorData } from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/api/errors";
import { apiClient } from "../../lib/api/client";
import { errorMessage } from "../../lib/error-messages";
import { clampProgress, isHlsPlaylist, refreshDelayMs } from "../../lib/playback";
import { watchPath } from "../../lib/watch-path";
import { DanmakuComposer } from "../danmaku/danmaku-composer";
import { DanmakuLayer, type FlyingComment } from "../danmaku/danmaku-layer";
import { DanmakuSettings } from "../danmaku/danmaku-settings";
import { ReportDialog } from "../danmaku/report-dialog";
import { useDanmaku } from "../danmaku/use-danmaku";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { PlayerControls } from "./player-controls";
import { ResumeDialog } from "./resume-dialog";

const MANIFEST_TIMEOUT_MS = 3000;
const FILE_TIMEOUT_MS = 20_000;
const PROGRESS_EVERY_MS = 10_000;

function saveProgress(episodeId: number, seconds: number): void {
  const progressSec = clampProgress(seconds);
  if (progressSec === null) return;
  void fetch(`/api/me/history/${episodeId}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ progressSec }),
    keepalive: true,
  }).catch(() => undefined);
}

export function VideoPlayer({
  slug,
  episodeId,
  measure,
}: {
  slug: string;
  episodeId: number;
  measure: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const started = useRef(false);
  const mark = useRef<number | null>(null);
  const authRetried = useRef(false);
  const staleRefresh = useRef(false);
  const [info, setInfo] = useState<PlaybackInfo | null>(null);
  const [failure, setFailure] = useState<"age" | "play" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<"pending" | "done">("pending");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const resumeAt = info?.resumeAtSec;
  const danmaku = useDanmaku(episodeId, videoRef, info !== null && failure !== "age");
  const [reportTarget, setReportTarget] = useState<FlyingComment | null>(null);
  const [reportedIds, setReportedIds] = useState<number[]>([]);

  useEffect(() => {
    setReportTarget(null);
    setReportedIds([]);
  }, [episodeId]);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setFailure(null);
    setChoice("pending");
    started.current = false;
    authRetried.current = false;
    apiClient<PlaybackInfo>(`/episodes/${episodeId}/playback`)
      .then((next) => {
        if (!cancelled) setInfo(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailure(error instanceof ApiError && error.code === "AGE_RESTRICTED" ? "age" : "play");
      });
    return () => {
      cancelled = true;
    };
  }, [episodeId, attempt]);

  useEffect(() => {
    if (!info) return;
    let cancelled = false;
    const refresh = () => {
      const video = videoRef.current;
      if (video) pendingSeek.current = video.currentTime;
      void apiClient<PlaybackInfo>(`/episodes/${episodeId}/playback`)
        .then((next) => {
          if (!cancelled) setInfo(next);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setFailure(error instanceof ApiError && error.code === "AGE_RESTRICTED" ? "age" : "play");
        });
    };
    const delay = refreshDelayMs(info.expiresAt, Date.now());
    if (delay === 0) {
      if (!staleRefresh.current) {
        staleRefresh.current = true;
        refresh();
      }
      return () => {
        cancelled = true;
      };
    }
    staleRefresh.current = false;
    const timer = window.setTimeout(refresh, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [episodeId, info]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !info || failure) return;
    let dead = false;
    let hls: { destroy: () => void } | null = null;
    let timer = 0;
    const giveUp = () => {
      if (!dead) setFailure("play");
    };
    const playlist = isHlsPlaylist(info.hlsUrl);
    const useNative = playlist && video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (!playlist || useNative) {
      timer = window.setTimeout(() => {
        video.removeAttribute("src");
        video.load();
        giveUp();
      }, playlist ? MANIFEST_TIMEOUT_MS : FILE_TIMEOUT_MS);
      const ready = () => window.clearTimeout(timer);
      video.addEventListener("loadedmetadata", ready);
      video.src = info.hlsUrl;
      video.addEventListener(
        "error",
        () => {
          ready();
          giveUp();
        },
        { once: true },
      );
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (dead) return;
        if (!Hls.isSupported()) {
          giveUp();
          return;
        }
        const player = new Hls({
          manifestLoadingTimeOut: MANIFEST_TIMEOUT_MS,
          manifestLoadingMaxRetry: 0,
          fragLoadingTimeOut: 90_000,
          startPosition: pendingSeek.current ?? 0,
        });
        hls = player;
        player.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
          if (dead || !data.fatal) return;
          const code = data.response?.code;
          if ((code === 401 || code === 403) && !authRetried.current) {
            authRetried.current = true;
            pendingSeek.current = video.currentTime;
            void apiClient<PlaybackInfo>(`/episodes/${episodeId}/playback`)
              .then((next) => {
                if (!dead) setInfo(next);
              })
              .catch(() => {
                if (!dead) setFailure("play");
              });
            return;
          }
          giveUp();
        });
        player.loadSource(info.hlsUrl);
        player.attachMedia(video);
      });
    }

    return () => {
      dead = true;
      window.clearTimeout(timer);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [episodeId, failure, info]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      if (pendingSeek.current === null || video.readyState < 1) return;
      video.currentTime = pendingSeek.current;
      pendingSeek.current = null;
    };
    video.addEventListener("loadedmetadata", apply);
    return () => video.removeEventListener("loadedmetadata", apply);
  }, [info]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      for (const track of video.textTracks) {
        if (track.kind !== "subtitles") continue;
        track.mode = captionsOn && track.language === "vi" ? "showing" : "disabled";
      }
    };
    apply();
    video.textTracks.addEventListener("addtrack", apply);
    return () => video.textTracks.removeEventListener("addtrack", apply);
  }, [captionsOn, info]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failure === "age") return;
    const send = () => {
      if (!started.current) return;
      saveProgress(episodeId, video.currentTime);
    };
    let timer = 0;
    const onPlay = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        if (!video.paused) send();
      }, PROGRESS_EVERY_MS);
    };
    const onPause = () => {
      window.clearInterval(timer);
      send();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    return () => {
      window.clearInterval(timer);
      send();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
    };
  }, [episodeId, failure]);

  const actions = useRef<{
    play: () => void;
    pause: () => void;
    seekBy: (delta: number) => void;
    toggleMute: () => void;
    toggleFullscreen: () => void;
  }>({
    play: () => undefined,
    pause: () => undefined,
    seekBy: () => undefined,
    toggleMute: () => undefined,
    toggleFullscreen: () => undefined,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, button, a"))
        return;
      const video = videoRef.current;
      if (!video || failure) return;
      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        if (video.paused) actions.current.play();
        else actions.current.pause();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        actions.current.seekBy(-5);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        actions.current.seekBy(5);
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        actions.current.toggleFullscreen();
      } else if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        actions.current.toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [failure]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    const next = Math.max(0, seconds);
    pendingSeek.current = next;
    if (video && video.readyState >= 1) {
      video.currentTime = next;
      pendingSeek.current = null;
    }
    setCurrent(next);
  };

  const seekBy = (delta: number) => {
    const video = videoRef.current;
    seekTo((video?.currentTime ?? current) + delta);
  };

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    started.current = true;
    if (measure) mark.current = performance.now();
    void video.play().catch(() => {
      mark.current = null;
    });
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  // Khung bọc nhận toàn màn hình, không phải thẻ video, để lớp phủ sau này vẫn nằm trong khung.
  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.requestFullscreen();
    } catch {
      setFullscreen(false);
    }
  };

  actions.current = {
    play,
    pause: () => videoRef.current?.pause(),
    seekBy,
    toggleMute,
    toggleFullscreen: () => void toggleFullscreen(),
  };

  if (failure === "age") {
    return (
      <p role="alert" className="rounded-card bg-card px-4 py-6 text-sm">
        {errorMessage("AGE_RESTRICTED")}
      </p>
    );
  }

  const captionsDisabled = !info?.subtitles.some((track) => track.language === "vi");

  return (
    <div className="grid gap-3">
      {info?.nextEpisodeId ? (
        <Link
          href={watchPath(slug, info.nextEpisodeId)}
          className="inline-flex h-10 w-fit items-center rounded-control bg-raised px-4 text-sm font-semibold"
        >
          Tập tiếp
        </Link>
      ) : null}
      <div
        ref={frameRef}
        className={`relative overflow-hidden bg-black md:rounded-card ${fullscreen ? "flex h-full flex-col" : ""}`}
      >
        <video
          ref={videoRef}
          className={fullscreen ? "min-h-0 w-full flex-1 object-contain" : "aspect-video w-full"}
          playsInline
          crossOrigin="anonymous"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onPlaying={() => {
            if (mark.current === null) return;
            console.info(`NFR04 ${Math.round(performance.now() - mark.current)}`);
            mark.current = null;
          }}
        >
          {info?.subtitles
            .filter((track) => track.language === "vi")
            .map((track) => (
              <track
                key={track.language}
                kind="subtitles"
                srcLang={track.language}
                label={track.label}
                src={track.url}
              />
            ))}
        </video>
        {info ? (
          <DanmakuLayer
            paused={!playing && danmaku.settings.enabled}
            opacity={danmaku.settings.opacity}
            width={danmaku.bandWidth}
            flying={danmaku.settings.enabled ? danmaku.flying : []}
            reportedIds={reportedIds}
            onMeasure={danmaku.measure}
            onDone={danmaku.finish}
            onReport={setReportTarget}
          />
        ) : null}
        {!info && !failure ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        ) : null}
        {failure === "play" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-page/80 p-4 text-center">
            <p role="alert" className="text-sm">
              Không phát được phim này.
            </p>
            <Button
              onClick={() => {
                authRetried.current = false;
                staleRefresh.current = false;
                setAttempt((value) => value + 1);
              }}
            >
              Thử lại
            </Button>
          </div>
        ) : null}
        <PlayerControls
          playing={playing}
          current={current}
          duration={duration}
          muted={muted}
          volume={volume}
          fullscreen={fullscreen}
          captionsOn={captionsOn}
          captionsDisabled={captionsDisabled}
          onToggle={() => {
            const video = videoRef.current;
            if (!video || video.paused) play();
            else video.pause();
          }}
          onSeekBy={seekBy}
          onSeek={seekTo}
          onVolume={(value) => {
            const video = videoRef.current;
            if (!video) return;
            video.volume = value;
            video.muted = value === 0;
            setVolume(value);
            setMuted(value === 0);
          }}
          onToggleMute={toggleMute}
          onCaptions={setCaptionsOn}
          onFullscreen={() => void toggleFullscreen()}
          danmaku={
            <DanmakuSettings settings={danmaku.settings} onChange={danmaku.updateSettings} />
          }
          composer={
            fullscreen && info ? (
              <DanmakuComposer
                status={danmaku.status}
                notice={danmaku.notice}
                cooldownUntil={danmaku.cooldownUntil}
                onSend={danmaku.send}
              />
            ) : null
          }
        />
      </div>
      {!fullscreen && info ? (
        <DanmakuComposer
          status={danmaku.status}
          notice={danmaku.notice}
          cooldownUntil={danmaku.cooldownUntil}
          onSend={danmaku.send}
        />
      ) : null}
      {reportTarget ? (
        <ReportDialog
          open
          danmakuId={reportTarget.id}
          content={reportTarget.content}
          onClose={() => setReportTarget(null)}
          onReported={() =>
            setReportedIds((ids) =>
              ids.includes(reportTarget.id) ? ids : [...ids, reportTarget.id],
            )
          }
        />
      ) : null}
      <ResumeDialog
        open={resumeAt !== undefined && choice === "pending" && failure === null && info !== null}
        atSec={resumeAt ?? 0}
        onResume={() => {
          setChoice("done");
          if (resumeAt !== undefined) seekTo(resumeAt);
          play();
        }}
        onStart={() => {
          setChoice("done");
          seekTo(0);
          play();
        }}
      />
    </div>
  );
}
