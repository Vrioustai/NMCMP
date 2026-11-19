-- CreateEnum
CREATE TYPE "role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "movie_type" AS ENUM ('MOVIE', 'SERIES');

-- CreateEnum
CREATE TYPE "movie_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "age_rating" AS ENUM ('P', 'K', 'T13', 'T16', 'T18');

-- CreateEnum
CREATE TYPE "credit_role" AS ENUM ('DIRECTOR', 'ACTOR');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "moderation_action" AS ENUM ('HIDE', 'DELETE', 'WARN');

-- CreateTable
CREATE TABLE "users" (
    "id_user" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "birth_year" INTEGER NOT NULL,
    "role" "role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id_user")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id_password_reset_token" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id_password_reset_token")
);

-- CreateTable
CREATE TABLE "movies" (
    "id_movie" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "description" TEXT NOT NULL,
    "type" "movie_type" NOT NULL,
    "release_year" INTEGER NOT NULL,
    "age_rating" "age_rating" NOT NULL,
    "status" "movie_status" NOT NULL DEFAULT 'DRAFT',
    "poster_url" TEXT,
    "backdrop_url" TEXT,
    "trailer_url" TEXT,
    "source_url" TEXT,
    "license" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id_movie")
);

-- CreateTable
CREATE TABLE "genres" (
    "id_genre" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id_genre")
);

-- CreateTable
CREATE TABLE "movie_genres" (
    "movie_id" INTEGER NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "movie_genres_pkey" PRIMARY KEY ("movie_id","genre_id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id_country" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id_country")
);

-- CreateTable
CREATE TABLE "movie_countries" (
    "movie_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,

    CONSTRAINT "movie_countries_pkey" PRIMARY KEY ("movie_id","country_id")
);

-- CreateTable
CREATE TABLE "people" (
    "id_person" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id_person")
);

-- CreateTable
CREATE TABLE "movie_credits" (
    "movie_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "role" "credit_role" NOT NULL,

    CONSTRAINT "movie_credits_pkey" PRIMARY KEY ("movie_id","person_id","role")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id_episode" SERIAL NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "season_number" INTEGER NOT NULL DEFAULT 1,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "stream_uid" TEXT,
    "duration_sec" INTEGER,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id_episode")
);

-- CreateTable
CREATE TABLE "subtitles" (
    "id_subtitle" SERIAL NOT NULL,
    "episode_id" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "subtitles_pkey" PRIMARY KEY ("id_subtitle")
);

-- CreateTable
CREATE TABLE "watch_histories" (
    "id_watch_history" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "episode_id" INTEGER NOT NULL,
    "progress_sec" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_histories_pkey" PRIMARY KEY ("id_watch_history")
);

-- CreateTable
CREATE TABLE "danmakus" (
    "id_danmaku" SERIAL NOT NULL,
    "episode_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" VARCHAR(100) NOT NULL,
    "time_ms" INTEGER NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "danmakus_pkey" PRIMARY KEY ("id_danmaku")
);

-- CreateTable
CREATE TABLE "comments" (
    "id_comment" SERIAL NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id_comment")
);

-- CreateTable
CREATE TABLE "ratings" (
    "user_id" INTEGER NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "score" SMALLINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("user_id","movie_id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" INTEGER NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","movie_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id_report" SERIAL NOT NULL,
    "reporter_user_id" INTEGER NOT NULL,
    "danmaku_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'PENDING',
    "action" "moderation_action",
    "resolver_user_id" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id_report")
);

-- CreateTable
CREATE TABLE "banned_words" (
    "id_banned_word" SERIAL NOT NULL,
    "word" TEXT NOT NULL,
    "creator_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_words_pkey" PRIMARY KEY ("id_banned_word")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "movies_slug_key" ON "movies"("slug");

-- CreateIndex
CREATE INDEX "movies_status_published_at_idx" ON "movies"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE INDEX "movie_genres_genre_id_idx" ON "movie_genres"("genre_id");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE INDEX "movie_countries_country_id_idx" ON "movie_countries"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_movie_id_season_number_number_key" ON "episodes"("movie_id", "season_number", "number");

-- CreateIndex
CREATE UNIQUE INDEX "subtitles_episode_id_language_key" ON "subtitles"("episode_id", "language");

-- CreateIndex
CREATE INDEX "watch_histories_created_at_idx" ON "watch_histories"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "watch_histories_user_id_episode_id_key" ON "watch_histories"("user_id", "episode_id");

-- CreateIndex
CREATE INDEX "danmakus_episode_id_time_ms_idx" ON "danmakus"("episode_id", "time_ms");

-- CreateIndex
CREATE INDEX "comments_movie_id_created_at_idx" ON "comments"("movie_id", "created_at");

-- CreateIndex
CREATE INDEX "ratings_movie_id_idx" ON "ratings"("movie_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_user_id_danmaku_id_key" ON "reports"("reporter_user_id", "danmaku_id");

-- CreateIndex
CREATE UNIQUE INDEX "banned_words_word_key" ON "banned_words"("word");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id_movie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id_genre") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_countries" ADD CONSTRAINT "movie_countries_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id_movie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_countries" ADD CONSTRAINT "movie_countries_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id_country") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_credits" ADD CONSTRAINT "movie_credits_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id_movie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_credits" ADD CONSTRAINT "movie_credits_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id_person") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id_movie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtitles" ADD CONSTRAINT "subtitles_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id_episode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_histories" ADD CONSTRAINT "watch_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_histories" ADD CONSTRAINT "watch_histories_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id_episode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "danmakus" ADD CONSTRAINT "danmakus_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id_episode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "danmakus" ADD CONSTRAINT "danmakus_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id_movie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id_movie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id_movie") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolver_user_id_fkey" FOREIGN KEY ("resolver_user_id") REFERENCES "users"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_danmaku_id_fkey" FOREIGN KEY ("danmaku_id") REFERENCES "danmakus"("id_danmaku") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banned_words" ADD CONSTRAINT "banned_words_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;
