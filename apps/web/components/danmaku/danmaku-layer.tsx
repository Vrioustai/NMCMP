"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LANE_HEIGHT_PX } from "../../lib/danmaku/lanes";

export type FlyingComment = {
  key: string;
  id: number;
  lane: number;
  content: string;
};

export function DanmakuLayer({
  paused,
  opacity,
  width,
  flying,
  reportedIds,
  onMeasure,
  onDone,
  onReport,
}: {
  paused: boolean;
  opacity: number;
  width: number;
  flying: FlyingComment[];
  reportedIds: readonly number[];
  onMeasure: (height: number, width: number) => void;
  onDone: (key: string) => void;
  onReport: (item: FlyingComment) => void;
}) {
  const band = useRef<HTMLDivElement>(null);
  const measure = useRef(onMeasure);
  const [armed, setArmed] = useState<string | null>(null);
  measure.current = onMeasure;

  useEffect(() => {
    if (!paused) setArmed(null);
  }, [paused]);

  useLayoutEffect(() => {
    const node = band.current;
    if (!node) return;
    const read = () => measure.current(node.clientHeight, node.clientWidth);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={band}
      aria-hidden={paused ? undefined : true}
      className={`absolute inset-x-0 top-0 z-10 h-1/3 overflow-hidden ${paused ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{ ["--danmaku-width" as string]: `${width}px` }}
    >
      {flying.map((item) => (
        <FlyingText
          key={item.key}
          item={item}
          opacity={opacity}
          paused={paused}
          armed={armed === item.key}
          reported={reportedIds.includes(item.id)}
          onArm={() => setArmed(item.key)}
          onReport={() => onReport(item)}
          onDone={() => onDone(item.key)}
        />
      ))}
    </div>
  );
}

function FlyingText({
  item,
  opacity,
  paused,
  armed,
  reported,
  onArm,
  onReport,
  onDone,
}: {
  item: FlyingComment;
  opacity: number;
  paused: boolean;
  armed: boolean;
  reported: boolean;
  onArm: () => void;
  onReport: () => void;
  onDone: () => void;
}) {
  const node = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (node.current) node.current.textContent = item.content;
  }, [item.content]);

  return (
    <span
      className="absolute flex items-center gap-2 whitespace-nowrap"
      style={{
        top: item.lane * LANE_HEIGHT_PX,
        left: "100%",
        opacity: opacity / 100,
        animation: "danmaku-run 8s linear forwards",
      }}
      onAnimationEnd={onDone}
    >
      <button
        type="button"
        className="text-sm font-semibold text-ink drop-shadow-md"
        aria-label={item.content}
        disabled={!paused}
        onClick={onArm}
      >
        <span ref={node} />
      </button>
      {paused && armed ? (
        <button
          type="button"
          disabled={reported}
          className="rounded-control bg-board px-2 py-1 text-[13px] text-ink disabled:opacity-50"
          onClick={onReport}
        >
          Báo cáo
        </button>
      ) : null}
    </span>
  );
}
