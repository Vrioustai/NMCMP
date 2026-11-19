import type { AdminStats, DailyStat } from "@movie/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { statsRange } from "./stats-range";

type DayRow = {
  day: string;
  new_users: number;
  views: number;
  danmaku: number;
  reports: number;
};

type TotalRow = {
  new_users: number;
  views: number;
  danmaku: number;
  reports: number;
};

type TopRow = {
  id: number;
  slug: string;
  title: string;
  poster_url: string | null;
  views: number;
};

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(query: { from?: string; to?: string }, now = new Date()): Promise<AdminStats> {
    const range = statsRange(query, now);
    const [days, totals, topMovies] = await Promise.all([
      this.prisma.$queryRaw<DayRow[]>(daysSql(range.from, range.to)),
      this.prisma.$queryRaw<TotalRow[]>(totalsSql(range.from, range.to)),
      this.prisma.$queryRaw<TopRow[]>(topSql(range.from, range.to)),
    ]);
    const total = totals[0];
    return {
      ...range,
      days: days.map(toDay),
      totals: {
        newUsers: Number(total?.new_users ?? 0),
        views: Number(total?.views ?? 0),
        danmaku: Number(total?.danmaku ?? 0),
        reports: Number(total?.reports ?? 0),
      },
      topMovies: topMovies.map((row) => ({
        id: Number(row.id),
        slug: row.slug,
        title: row.title,
        posterUrl: row.poster_url,
        views: Number(row.views),
      })),
    };
  }
}

function toDay(row: DayRow): DailyStat {
  return {
    day: row.day,
    newUsers: Number(row.new_users),
    views: Number(row.views),
    danmaku: Number(row.danmaku),
    reports: Number(row.reports),
  };
}

function vietnamDate(column: string): Prisma.Sql {
  // Cột không có múi giờ và Prisma ghi giờ UTC, nên phải đọc lại thành giờ Việt Nam.
  return Prisma.raw(`(${column} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`);
}

function daysSql(from: string, to: string): Prisma.Sql {
  const userDay = vietnamDate("u.created_at");
  const viewDay = vietnamDate("w.created_at");
  const danmakuDay = vietnamDate("d.created_at");
  const reportDay = vietnamDate("r.created_at");
  return Prisma.sql`
    WITH days AS (
      SELECT generate_series(${from}::date, ${to}::date, interval '1 day')::date AS day
    ),
    users_by_day AS (
      SELECT ${userDay} AS day, COUNT(*)::int AS total
      FROM users u
      WHERE ${userDay} BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
    ),
    views_by_day AS (
      SELECT ${viewDay} AS day, COUNT(DISTINCT w.user_id)::int AS total
      FROM watch_histories w
      WHERE ${viewDay} BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
    ),
    danmaku_by_day AS (
      SELECT ${danmakuDay} AS day, COUNT(*)::int AS total
      FROM danmakus d
      WHERE ${danmakuDay} BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
    ),
    reports_by_day AS (
      SELECT ${reportDay} AS day, COUNT(*)::int AS total
      FROM reports r
      WHERE ${reportDay} BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
    )
    SELECT
      to_char(days.day, 'YYYY-MM-DD') AS day,
      COALESCE(users_by_day.total, 0) AS new_users,
      COALESCE(views_by_day.total, 0) AS views,
      COALESCE(danmaku_by_day.total, 0) AS danmaku,
      COALESCE(reports_by_day.total, 0) AS reports
    FROM days
    LEFT JOIN users_by_day ON users_by_day.day = days.day
    LEFT JOIN views_by_day ON views_by_day.day = days.day
    LEFT JOIN danmaku_by_day ON danmaku_by_day.day = days.day
    LEFT JOIN reports_by_day ON reports_by_day.day = days.day
    ORDER BY days.day
  `;
}

function totalsSql(from: string, to: string): Prisma.Sql {
  const userDay = vietnamDate("u.created_at");
  const viewDay = vietnamDate("w.created_at");
  const danmakuDay = vietnamDate("d.created_at");
  const reportDay = vietnamDate("r.created_at");
  return Prisma.sql`
    SELECT
      (SELECT COUNT(*)::int FROM users u
        WHERE ${userDay} BETWEEN ${from}::date AND ${to}::date) AS new_users,
      (SELECT COUNT(DISTINCT w.user_id)::int FROM watch_histories w
        WHERE ${viewDay} BETWEEN ${from}::date AND ${to}::date) AS views,
      (SELECT COUNT(*)::int FROM danmakus d
        WHERE ${danmakuDay} BETWEEN ${from}::date AND ${to}::date) AS danmaku,
      (SELECT COUNT(*)::int FROM reports r
        WHERE ${reportDay} BETWEEN ${from}::date AND ${to}::date) AS reports
  `;
}

function topSql(from: string, to: string): Prisma.Sql {
  const viewDay = vietnamDate("w.created_at");
  return Prisma.sql`
    SELECT m.id_movie AS id, m.slug, m.title, m.poster_url,
           COUNT(DISTINCT w.user_id)::int AS views
    FROM watch_histories w
    JOIN episodes e ON e.id_episode = w.episode_id
    JOIN movies m ON m.id_movie = e.movie_id
    WHERE m.status = 'PUBLISHED'::movie_status
      AND ${viewDay} BETWEEN ${from}::date AND ${to}::date
    GROUP BY m.id_movie, m.slug, m.title, m.poster_url, m.published_at
    ORDER BY views DESC, m.published_at DESC NULLS LAST, m.id_movie DESC
    LIMIT 10
  `;
}
