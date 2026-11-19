export const DENSITIES = [25, 50, 75, 100] as const;

export type Density = (typeof DENSITIES)[number];

export type DanmakuSettings = {
  enabled: boolean;
  density: Density;
  opacity: number;
};

export const DEFAULT_SETTINGS: DanmakuSettings = {
  enabled: true,
  density: 100,
  opacity: 100,
};

const STORAGE_KEY = "fgz-danmaku";

export function parseSettings(raw: string | null): DanmakuSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<DanmakuSettings>;
    const density = DENSITIES.includes(value.density as Density) ? (value.density as Density) : 100;
    const opacity =
      typeof value.opacity === "number" && Number.isFinite(value.opacity)
        ? Math.min(100, Math.max(20, Math.round(value.opacity)))
        : 100;
    return {
      enabled: value.enabled !== false,
      density,
      opacity,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function readSettings(storage: Pick<Storage, "getItem"> | null): DanmakuSettings {
  if (!storage) return DEFAULT_SETTINGS;
  try {
    return parseSettings(storage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(
  storage: Pick<Storage, "setItem"> | null,
  value: DanmakuSettings,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Trình duyệt chặn kho lưu (chế độ riêng tư) thì giữ cài đặt trong phiên.
  }
}
