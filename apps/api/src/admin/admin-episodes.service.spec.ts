import { AppError } from "../common/app-error";
import { AdminEpisodesService } from "./admin-episodes.service";

const episode = {
  id: 7,
  movieId: 3,
  seasonNumber: 1,
  number: 2,
  title: null,
  streamUid: null,
  durationSec: null,
  movie: { slug: "phim-bo", type: "SERIES" },
  subtitles: [],
};

function harness(video: Record<string, jest.Mock>) {
  const prisma = {
    movie: { findUnique: jest.fn() },
    episode: {
      findUnique: jest.fn().mockResolvedValue(episode),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const storage = { remove: jest.fn() };
  const service = new AdminEpisodesService(prisma as never, storage as never, video as never);
  return { service, prisma, storage };
}

describe("AdminEpisodesService", () => {
  it("enables signed urls before saving the stream uid", async () => {
    const calls: string[] = [];
    const { service, prisma } = harness({
      getVideo: jest.fn(async () => {
        calls.push("get");
        return { uid: "unsigned:1", durationSec: 12.5, requireSignedURLs: false, ready: true };
      }),
      enableSignedUrls: jest.fn(async () => {
        calls.push("enable");
      }),
      createDirectUpload: jest.fn(),
      copyFromUrl: jest.fn(),
      createPlaybackUrl: jest.fn(),
    });
    prisma.episode.update.mockImplementation(async ({ data }) => {
      calls.push("db");
      return { ...episode, ...data };
    });

    const saved = await service.setStream(7, { streamUid: "unsigned:1" });
    expect(calls).toEqual(["get", "enable", "db"]);
    expect(saved).toMatchObject({ streamUid: "unsigned:1", durationSec: 13 });
  });

  it("does not write when the provider fails or the video is not ready", async () => {
    const failing = harness({
      getVideo: jest.fn(async () => {
        throw new AppError("VIDEO_PROVIDER_ERROR");
      }),
      enableSignedUrls: jest.fn(),
      createDirectUpload: jest.fn(),
      copyFromUrl: jest.fn(),
      createPlaybackUrl: jest.fn(),
    });
    await expect(failing.service.setStream(7, { streamUid: "error" })).rejects.toMatchObject({
      code: "VIDEO_PROVIDER_ERROR",
    });
    expect(failing.prisma.episode.update).not.toHaveBeenCalled();

    const enableSignedUrls = jest.fn();
    const pending = harness({
      getVideo: jest.fn(async () => ({
        uid: "pending",
        durationSec: null,
        requireSignedURLs: true,
        ready: false,
      })),
      enableSignedUrls,
      createDirectUpload: jest.fn(),
      copyFromUrl: jest.fn(),
      createPlaybackUrl: jest.fn(),
    });
    await expect(pending.service.setStream(7, { streamUid: "pending" })).rejects.toBeInstanceOf(
      AppError,
    );
    expect(pending.prisma.episode.update).not.toHaveBeenCalled();
    expect(enableSignedUrls).not.toHaveBeenCalled();
  });

  it("asks for a signed direct upload and does not store a copied uid", async () => {
    const video = {
      getVideo: jest.fn(),
      enableSignedUrls: jest.fn(),
      createPlaybackUrl: jest.fn(),
      createDirectUpload: jest.fn(async () => ({
        uid: "up-1",
        uploadUrl: "https://upload.example/up-1",
      })),
      copyFromUrl: jest.fn(async () => ({ uid: "copy-1" })),
    };
    const { service, prisma } = harness(video);
    await expect(service.createUpload(7, {})).resolves.toEqual({
      uid: "up-1",
      uploadUrl: "https://upload.example/up-1",
    });
    expect(video.createDirectUpload).toHaveBeenCalledWith({
      maxDurationSeconds: 3600,
      metaName: "phim-bo/s1e2",
    });
    await expect(service.copyStream(7, { url: "https://cdn.example/a.mp4" })).resolves.toEqual({
      streamUid: "copy-1",
    });
    expect(video.copyFromUrl).toHaveBeenCalledWith("https://cdn.example/a.mp4", "phim-bo/s1e2");
    expect(prisma.episode.update).not.toHaveBeenCalled();
  });

  it("refuses a second episode on a single movie", async () => {
    const { service, prisma } = harness({
      getVideo: jest.fn(),
      enableSignedUrls: jest.fn(),
      createDirectUpload: jest.fn(),
      copyFromUrl: jest.fn(),
      createPlaybackUrl: jest.fn(),
    });
    prisma.movie.findUnique.mockResolvedValue({ id: 3, type: "MOVIE" });
    await expect(service.create(3, { number: 2 })).rejects.toBeInstanceOf(AppError);
    expect(prisma.episode.create).not.toHaveBeenCalled();
  });
});
