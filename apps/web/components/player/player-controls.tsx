"use client";

import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatDuration } from "../../lib/format";
import { IconButton } from "../ui/icon-button";
import { SubtitleMenu } from "./subtitle-menu";

export function PlayerControls({
  playing,
  current,
  duration,
  muted,
  volume,
  fullscreen,
  captionsOn,
  captionsDisabled,
  onToggle,
  onSeekBy,
  onSeek,
  onVolume,
  onToggleMute,
  onCaptions,
  onFullscreen,
  danmaku,
  composer,
}: {
  playing: boolean;
  current: number;
  duration: number;
  muted: boolean;
  volume: number;
  fullscreen: boolean;
  captionsOn: boolean;
  captionsDisabled: boolean;
  onToggle: () => void;
  onSeekBy: (seconds: number) => void;
  onSeek: (seconds: number) => void;
  onVolume: (volume: number) => void;
  onToggleMute: () => void;
  onCaptions: (on: boolean) => void;
  onFullscreen: () => void;
  danmaku?: ReactNode;
  composer?: ReactNode;
}) {
  const known = Number.isFinite(duration) && duration > 0;
  return (
    <div className="absolute inset-x-0 bottom-0 grid gap-2 bg-linear-to-t from-page/95 to-transparent p-3">
      <input
        aria-label="Thanh tua"
        type="range"
        min={0}
        max={known ? duration : 0}
        step={1}
        value={known ? Math.min(current, duration) : 0}
        disabled={!known}
        className="w-full accent-accent disabled:opacity-50"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      {composer}
      <div className="flex flex-wrap items-center gap-2">
        <IconButton aria-label={playing ? "Tạm dừng" : "Phát"} onClick={onToggle}>
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </IconButton>
        <IconButton aria-label="Tua lùi 10 giây" onClick={() => onSeekBy(-10)}>
          <RotateCcw size={20} />
        </IconButton>
        <IconButton aria-label="Tua tới 10 giây" onClick={() => onSeekBy(10)}>
          <RotateCw size={20} />
        </IconButton>
        <span className="text-[13px] text-muted">
          {formatDuration(current)}
          {known ? ` / ${formatDuration(duration)}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <IconButton aria-label={muted ? "Bật tiếng" : "Tắt tiếng"} onClick={onToggleMute}>
            {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </IconButton>
          <input
            aria-label="Âm lượng"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            className="hidden w-20 accent-accent sm:block"
            onChange={(event) => onVolume(Number(event.target.value))}
          />
          {danmaku}
          <SubtitleMenu disabled={captionsDisabled} enabled={captionsOn} onChange={onCaptions} />
          <IconButton
            aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            onClick={onFullscreen}
          >
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}
