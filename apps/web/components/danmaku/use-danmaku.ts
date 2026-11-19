"use client";

import {
  DANMAKU_COOLDOWN_MS,
  type DanmakuAck,
  type DanmakuItem,
  type DanmakuRejectReason,
} from "@movie/contracts";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { io, type Socket } from "socket.io-client";
import { apiClient } from "../../lib/api/client";
import { laneCount, pickLane } from "../../lib/danmaku/lanes";
import { liveDecision } from "../../lib/danmaku/live";
import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type DanmakuSettings,
} from "../../lib/danmaku/settings";
import { danmakuEndpoint } from "../../lib/danmaku/socket-url";
import { commentsDue, cursorAfterSeek, insertComment, isSeek } from "../../lib/danmaku/timeline";
import { rejectMessage, type DanmakuLink } from "./danmaku-composer";
import type { FlyingComment } from "./danmaku-layer";

type Engine = {
  settings: DanmakuSettings;
  updateSettings: (patch: Partial<DanmakuSettings>) => void;
  status: DanmakuLink;
  notice: string | null;
  cooldownUntil: number;
  flying: FlyingComment[];
  bandWidth: number;
  send: (content: string) => void;
  measure: (height: number, width: number) => void;
  finish: (key: string) => void;
};

export function useDanmaku(
  episodeId: number,
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
): Engine {
  const [settings, setSettings] = useState<DanmakuSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<DanmakuLink>("connecting");
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [flying, setFlying] = useState<FlyingComment[]>([]);
  const [bandWidth, setBandWidth] = useState(0);
  const settingsRef = useRef(settings);
  const itemsRef = useRef<DanmakuItem[]>([]);
  const cursorRef = useRef(0);
  const shownRef = useRef(new Set<number>());
  const freeAtRef = useRef<number[]>([]);
  const lanesRef = useRef(1);
  const bandRef = useRef({ height: 0 });
  const spawnRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const videoTime = useCallback(
    () => Math.round((videoRef.current?.currentTime ?? 0) * 1000),
    [videoRef],
  );

  useEffect(() => {
    const stored = readSettings(typeof window === "undefined" ? null : window.localStorage);
    settingsRef.current = stored;
    setSettings(stored);
  }, []);

  const spawn = useCallback((item: DanmakuItem) => {
    const count = Math.max(1, lanesRef.current);
    if (freeAtRef.current.length !== count) {
      freeAtRef.current = Array.from({ length: count }, () => 0);
    }
    const picked = pickLane(freeAtRef.current, performance.now());
    freeAtRef.current = picked.freeAt;
    spawnRef.current += 1;
    const key = `${item.id}-${spawnRef.current}`;
    setFlying((rows) => [...rows, { key, id: item.id, lane: picked.lane, content: item.content }]);
  }, []);

  const ingest = useCallback(
    (item: DanmakuItem, mine: boolean) => {
      const placed = insertComment(itemsRef.current, cursorRef.current, item);
      itemsRef.current = placed.items;
      cursorRef.current = placed.cursor;
      if (shownRef.current.has(item.id) || !settingsRef.current.enabled) return;
      if (liveDecision({ mine, commentTimeMs: item.timeMs, videoTimeMs: videoTime() }) !== "now") {
        return;
      }
      shownRef.current.add(item.id);
      spawn(item);
    },
    [spawn, videoTime],
  );

  const updateSettings = useCallback(
    (patch: Partial<DanmakuSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        settingsRef.current = next;
        writeSettings(typeof window === "undefined" ? null : window.localStorage, next);
        lanesRef.current = laneCount(bandRef.current.height, next.density);
        if (patch.enabled === false) setFlying([]);
        if (patch.enabled === true) {
          cursorRef.current = cursorAfterSeek(itemsRef.current, videoTime());
          shownRef.current = new Set();
        }
        if (patch.density !== undefined) freeAtRef.current = [];
        return next;
      });
    },
    [videoTime],
  );

  const measure = useCallback((height: number, width: number) => {
    bandRef.current = { height };
    lanesRef.current = laneCount(height, settingsRef.current.density);
    setBandWidth(width);
  }, []);

  const finish = useCallback((key: string) => {
    setFlying((rows) => rows.filter((row) => row.key !== key));
  }, []);

  useEffect(() => {
    if (!active) return;
    let closed = false;
    const socket = io(danmakuEndpoint(process.env.NEXT_PUBLIC_SOCKET_URL), {
      withCredentials: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
    });
    socketRef.current = socket;

    const resetView = (nowMs: number) => {
      cursorRef.current = cursorAfterSeek(itemsRef.current, nowMs);
      shownRef.current = new Set();
      freeAtRef.current = [];
      setFlying([]);
    };

    const backfill = async () => {
      try {
        const list = await apiClient<DanmakuItem[]>(`/episodes/${episodeId}/danmaku`);
        if (closed) return;
        itemsRef.current = list
          .map((item) => ({ id: item.id, content: item.content, timeMs: item.timeMs }))
          .sort((left, right) => left.timeMs - right.timeMs || left.id - right.id);
        resetView(videoTime());
      } catch {
        if (!closed) resetView(videoTime());
      }
    };

    const join = () => {
      setStatus("connecting");
      socket.emit("danmaku:join", { episodeId }, (ack: { ok?: boolean }) => {
        if (closed) return;
        if (!ack?.ok) {
          setStatus("denied");
          return;
        }
        setStatus("live");
        void backfill();
      });
    };

    socket.on("connect", join);
    socket.on("disconnect", (reason) => {
      if (closed || reason === "io client disconnect") return;
      setStatus("reconnecting");
    });
    socket.on("danmaku:new", (payload: DanmakuItem) => {
      if (closed || typeof payload?.id !== "number") return;
      ingest({ id: payload.id, content: String(payload.content), timeMs: payload.timeMs }, false);
    });
    socket.on("danmaku:rejected", (payload: { reason?: DanmakuRejectReason }) => {
      if (!closed) setNotice(rejectMessage(payload?.reason));
    });

    let lastMs: number | null = null;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video) return;
      const nowMs = video.currentTime * 1000;
      if (lastMs !== null && isSeek(lastMs, nowMs)) {
        resetView(nowMs);
        lastMs = nowMs;
        return;
      }
      lastMs = nowMs;
      if (!settingsRef.current.enabled || video.paused) return;
      const step = commentsDue(itemsRef.current, cursorRef.current, nowMs);
      cursorRef.current = step.cursor;
      for (const item of step.due) {
        if (shownRef.current.has(item.id)) continue;
        shownRef.current.add(item.id);
        spawn(item);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      closed = true;
      cancelAnimationFrame(frame);
      socketRef.current = null;
      socket.disconnect();
    };
  }, [active, episodeId, ingest, spawn, videoRef, videoTime]);

  const send = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!socket) return;
      const timeMs = videoTime();
      setNotice(null);
      socket
        .timeout(5000)
        .emit("danmaku:send", { episodeId, content, timeMs }, (error: unknown, ack: DanmakuAck) => {
          if (error || !ack?.ok) {
            const reason = ack && ack.ok === false ? ack.reason : undefined;
            setNotice(rejectMessage(reason));
            if (reason === "RATE_LIMIT") setCooldownUntil(Date.now() + DANMAKU_COOLDOWN_MS);
            return;
          }
          setCooldownUntil(Date.now() + DANMAKU_COOLDOWN_MS);
          ingest({ id: ack.id, content, timeMs }, true);
        });
    },
    [episodeId, ingest, videoTime],
  );

  return {
    settings,
    updateSettings,
    status,
    notice,
    cooldownUntil,
    flying,
    bandWidth,
    send,
    measure,
    finish,
  };
}
