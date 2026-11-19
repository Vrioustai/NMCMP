export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;
export const BIRTH_YEAR_MIN = 1900;
export const SEARCH_QUERY_MAX_LENGTH = 100;
export const COMMENT_MAX_LENGTH = 1000;
export const PAGE_SIZE_DEFAULT = 24;
export const PAGE_SIZE_MAX = 48;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SUBTITLE_MAX_BYTES = 1024 * 1024;
export const VIDEO_DIRECT_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;

export const AGE_RATINGS = ["P", "K", "T13", "T16", "T18"] as const;
export type AgeRating = (typeof AGE_RATINGS)[number];

export const MOVIE_TYPES = ["MOVIE", "SERIES"] as const;
export type MovieType = (typeof MOVIE_TYPES)[number];

export const MOVIE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type MovieStatus = (typeof MOVIE_STATUSES)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = ["home", "trending"] as const;

export const AVATAR_URLS = [
  "/avatars/avatar-01.webp",
  "/avatars/avatar-02.webp",
  "/avatars/avatar-03.webp",
  "/avatars/avatar-04.webp",
  "/avatars/avatar-05.webp",
  "/avatars/avatar-06.webp",
  "/avatars/avatar-07.webp",
  "/avatars/avatar-08.webp",
  "/avatars/avatar-09.webp",
  "/avatars/avatar-10.webp",
  "/avatars/avatar-11.webp",
  "/avatars/avatar-12.webp",
] as const;

export function isAvatarUrl(value: string): value is (typeof AVATAR_URLS)[number] {
  return (AVATAR_URLS as readonly string[]).includes(value);
}

export type Role = "USER" | "ADMIN";

export type UserProfile = {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  birthYear: number;
  role: Role;
};

export type NamedRef = { id: number; name: string };

export type Genre = { id: number; name: string };

export type AdminGenre = Genre & { movieCount: number };

export type AdminMovie = {
  id: number;
  slug: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number;
  ageRating: AgeRating;
  type: MovieType;
  status: MovieStatus;
  episodeCount: number;
  episodesWithStream: number;
};

export type AdminEpisodeSummary = {
  id: number;
  seasonNumber: number;
  number: number;
  title: string | null;
  streamUid: string | null;
  durationSec: number | null;
  subtitleUrl: string | null;
};

export type AdminMovieDetail = AdminMovie & {
  originalTitle: string | null;
  description: string;
  backdropUrl: string | null;
  trailerUrl: string | null;
  sourceUrl: string | null;
  license: string | null;
  publishedAt: string | null;
  genres: NamedRef[];
  countries: NamedRef[];
  directors: NamedRef[];
  actors: NamedRef[];
  episodes: AdminEpisodeSummary[];
};

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type Country = { id: number; name: string };

export type MovieCard = {
  id: number;
  slug: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number;
  ageRating: AgeRating;
  type: MovieType;
  trailerUrl: string | null;
};

export type EpisodeSummary = {
  id: number;
  seasonNumber: number;
  number: number;
  title: string | null;
  durationSec: number | null;
};

export type MovieDetail = MovieCard & {
  originalTitle: string | null;
  description: string;
  backdropUrl: string | null;
  genres: Genre[];
  countries: Country[];
  directors: NamedRef[];
  actors: NamedRef[];
  seasons: { number: number; episodes: EpisodeSummary[] }[];
  ratingAverage: number | null;
  ratingCount: number;
  sourceUrl: string | null;
  license: string | null;
};

export type HomeSections = {
  newList: MovieCard[];
  trendingList: MovieCard[];
  byGenre: { genre: Genre; items: MovieCard[] }[];
};

export const AGE_GATE_RATING = "T18";
export const AGE_GATE_MIN_AGE = 18;

export type SubtitleTrack = {
  language: string;
  label: string;
  url: string;
};

export type PlaybackInfo = {
  episodeId: number;
  hlsUrl: string;
  expiresAt: string;
  subtitles: SubtitleTrack[];
  resumeAtSec?: number;
  nextEpisodeId: number | null;
};

export const DANMAKU_MAX_LENGTH = 100;
export const DANMAKU_COOLDOWN_MS = 3000;
export const REPORT_MAX_LENGTH = 200;

export type DanmakuItem = {
  id: number;
  content: string;
  timeMs: number;
};

export type DanmakuSendPayload = {
  episodeId: number;
  content: string;
  timeMs: number;
};

export type DanmakuRejectReason = "TOO_LONG" | "BANNED_WORD" | "RATE_LIMIT";

export type DanmakuAck = { ok: true; id: number } | { ok: false; reason?: DanmakuRejectReason };

export type RatingSummary = {
  ratingAverage: number;
  ratingCount: number;
};

export type MovieUserState = {
  myScore: number | null;
  isFavorite: boolean;
};

export type CommentItem = {
  id: number;
  content: string;
  createdAt: string;
  user: { displayName: string; avatarUrl: string | null };
};

export type WatchHistoryItem = {
  movie: Pick<
    MovieCard,
    "id" | "slug" | "title" | "posterUrl" | "releaseYear" | "ageRating" | "type"
  >;
  episode: EpisodeSummary;
  progressSec: number;
  watchedAt: string;
};

export type AdminMovieList = Page<AdminMovie> & {
  counts: { all: number; draft: number; published: number };
};

export type UserStatus = "ACTIVE" | "LOCKED";

export type AdminUser = {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastActiveAt: string | null;
  warningCount: number;
};

export type AdminUserList = Page<AdminUser> & {
  counts: { all: number; active: number; locked: number };
};

export type ReportStatus = "PENDING" | "RESOLVED" | "REJECTED";

export type ModerationAction = "HIDE" | "DELETE" | "WARN";

export type ModerationDecision = ModerationAction | "REJECT";

export type AdminReport = {
  id: number;
  status: ReportStatus;
  action: ModerationAction | null;
  reason: string;
  createdAt: string;
  danmaku: { id: number; content: string; timeMs: number };
  movie: { title: string };
  episode: { seasonNumber: number; number: number };
  sender: { displayName: string };
  reportCount: number;
};

export type AdminReportList = Page<AdminReport> & {
  counts: { pending: number; handled: number };
};

export type BannedWord = {
  id: number;
  word: string;
  createdAt: string;
  creator: { displayName: string };
};

export type DailyStat = {
  day: string;
  newUsers: number;
  views: number;
  danmaku: number;
  reports: number;
};

export type AdminStats = {
  from: string;
  to: string;
  days: DailyStat[];
  totals: Omit<DailyStat, "day">;
  topMovies: {
    id: number;
    slug: string;
    title: string;
    posterUrl: string | null;
    views: number;
  }[];
};

export type MovieSummary = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  rating: number | null;
};
