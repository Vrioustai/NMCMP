import type { UserProfile } from "@movie/contracts";
import { AppError } from "../common/app-error";
import type { PrismaService } from "../prisma/prisma.service";
import type { VideoProvider } from "../video/video-provider";
import { drivePlaybackUrl, hlsPlaybackUrl } from "../video/drive-clips";
import { PlaybackService, resumeAtSec } from "./playback.service";

const NOW = new Date("2026-06-15T03:00:00.000Z");

const viewer: UserProfile = {
  id: 5,
  email: "xem@filmgenz.test",
  displayName: "Xem",
  avatarUrl: null,
  birthYear: 2000,
  role: "USER",
};

function episode(extra: Record<string, unknown> = {}) {
  return {
    id: 12,
    movieId: 3,
    seasonNumber: 1,
    number: 1,
    streamUid: "uid-1",
    durationSec: 1200,
    movie: { status: "PUBLISHED", ageRating: "T16" },
    subtitles: [{ language: "vi", url: "/media/subtitles/bo/s1e1.vi.vtt" }],
    ...extra,
  };
}

function service(options: {
  episode: Record<string, unknown> | null;
  history?: { progressSec: number } | null;
  next?: { id: number } | null;
}) {
  const createPlaybackUrl = jest.fn().mockResolvedValue({
    hlsUrl: "https://filmgenz.invalid/video.m3u8",
    expiresAt: new Date("2026-06-15T05:00:00.000Z"),
  });
  const findUnique = jest.fn().mockResolvedValue(options.episode);
  const findFirst = jest.fn().mockResolvedValue(options.next ?? null);
  const history = jest
    .fn()
    .mockResolvedValue(options.history === undefined ? null : options.history);
  const playback = new PlaybackService(
    {
      episode: { findUnique, findFirst },
      watchHistory: { findUnique: history },
    } as unknown as PrismaService,
    {
      getOrThrow: (key: string) => {
        if (key === "PLAYBACK_TOKEN_TTL_SEC") return 7200;
        if (key === "WEB_ORIGIN") return "http://localhost:3000";
        if (key === "JWT_SECRET") return "test-secret-test-secret-test-secret";
        throw new Error(key);
      },
    } as never,
    { createPlaybackUrl } as unknown as VideoProvider,
  );
  return { playback, createPlaybackUrl, findFirst, history };
}

describe("PlaybackService", () => {
  it("stops before signing when the episode is missing, draft, under age, or has no video", async () => {
    const missing = service({ episode: null });
    await expect(missing.playback.play(9, viewer, NOW)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(missing.createPlaybackUrl).not.toHaveBeenCalled();

    const draft = service({
      episode: episode({ movie: { status: "DRAFT", ageRating: "T18" } }),
    });
    await expect(draft.playback.play(12, viewer, NOW)).rejects.toBeInstanceOf(AppError);
    expect(draft.createPlaybackUrl).not.toHaveBeenCalled();

    const young = { ...viewer, birthYear: 2009 };
    const restricted = service({
      episode: episode({ streamUid: null, movie: { status: "PUBLISHED", ageRating: "T18" } }),
    });
    await expect(restricted.playback.play(12, young, NOW)).rejects.toMatchObject({
      code: "AGE_RESTRICTED",
    });
    expect(restricted.createPlaybackUrl).not.toHaveBeenCalled();

    const bare = service({ episode: episode({ streamUid: null }) });
    await expect(bare.playback.play(12, viewer, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(bare.createPlaybackUrl).not.toHaveBeenCalled();
    expect(bare.history).not.toHaveBeenCalled();
  });

  it("returns a signed link, the Vietnamese subtitle, resume point and the next episode", async () => {
    const ready = service({
      episode: episode({
        subtitles: [
          { language: "en", url: "/media/subtitles/bo/s1e1.en.vtt" },
          { language: "vi", url: "/media/subtitles/bo/s1e1.vi.vtt" },
        ],
      }),
      history: { progressSec: 750 },
      next: { id: 13 },
    });

    const body = await ready.playback.play(12, viewer, NOW);

    expect(ready.createPlaybackUrl).toHaveBeenCalledWith("uid-1", 7200);
    expect(body).toMatchObject({
      episodeId: 12,
      hlsUrl: "https://filmgenz.invalid/video.m3u8",
      expiresAt: "2026-06-15T05:00:00.000Z",
      resumeAtSec: 750,
      nextEpisodeId: 13,
    });
    expect(body.subtitles).toEqual([
      { language: "en", label: "en", url: "/media/subtitles/bo/s1e1.en.vtt" },
      { language: "vi", label: "Tiếng Việt", url: "/media/subtitles/bo/s1e1.vi.vtt" },
    ]);
    expect(ready.findFirst).toHaveBeenCalledWith({
      where: {
        movieId: 3,
        OR: [{ seasonNumber: 1, number: { gt: 1 } }, { seasonNumber: { gt: 1 } }],
      },
      orderBy: [{ seasonNumber: "asc" }, { number: "asc" }],
      select: { id: true },
    });
  });

  it("returns a Drive mp4 for a mapped movie and does not ask the sample provider", async () => {
    const ready = service({
      episode: episode({
        movie: { status: "PUBLISHED", ageRating: "T16", slug: "mat-ma-goc" },
      }),
    });
    const body = await ready.playback.play(12, viewer, NOW);
    const exp = Math.floor(NOW.getTime() / 1000) + 7200;
    expect(ready.createPlaybackUrl).not.toHaveBeenCalled();
    expect(body.hlsUrl).toBe(
      drivePlaybackUrl(
        "1Hg_uZQypaLZL_nHi9jR_w5xe4c2wrsR8",
        exp,
        "test-secret-test-secret-test-secret",
        "http://localhost:3000",
      ),
    );
    expect(body.expiresAt).toBe(new Date(exp * 1000).toISOString());
  });

  it("returns an HLS playlist for one of the five films and does not ask the sample provider", async () => {
    const ready = service({
      episode: episode({
        movie: { status: "PUBLISHED", ageRating: "T16", slug: "su-thi-odyssey" },
      }),
    });
    const body = await ready.playback.play(12, viewer, NOW);
    const exp = Math.floor(NOW.getTime() / 1000) + 7200;
    expect(ready.createPlaybackUrl).not.toHaveBeenCalled();
    expect(body.hlsUrl).toBe(
      hlsPlaybackUrl(
        "1dzOYkPkJ4aAt2v-J1soh-ECvtdGuDm05",
        exp,
        "test-secret-test-secret-test-secret",
        "http://localhost:3000",
      ),
    );
    expect(body.hlsUrl).toContain("/index.m3u8?");
  });

  it("omits the resume point unless more than ten seconds were watched and thirty remain", async () => {
    const early = service({ episode: episode(), history: { progressSec: 10 }, next: null });
    await expect(early.playback.play(12, viewer, NOW)).resolves.not.toHaveProperty("resumeAtSec");

    const fresh = service({ episode: episode() });
    await expect(fresh.playback.play(12, viewer, NOW)).resolves.not.toHaveProperty("resumeAtSec");

    const ending = service({
      episode: episode({ durationSec: 41 }),
      history: { progressSec: 11 },
    });
    await expect(ending.playback.play(12, viewer, NOW)).resolves.not.toHaveProperty("resumeAtSec");

    const unknown = service({
      episode: episode({ durationSec: null }),
      history: { progressSec: 750 },
    });
    const body = await unknown.playback.play(12, viewer, NOW);
    expect(body.resumeAtSec).toBeUndefined();
    expect(body.nextEpisodeId).toBeNull();
  });
});

describe("resumeAtSec", () => {
  it("keeps a point only when both margins are clear", () => {
    expect(resumeAtSec(11, 42)).toBe(11);
    expect(resumeAtSec(11, 41)).toBeUndefined();
    expect(resumeAtSec(10, 1200)).toBeUndefined();
    expect(resumeAtSec(750, null)).toBeUndefined();
  });
});
