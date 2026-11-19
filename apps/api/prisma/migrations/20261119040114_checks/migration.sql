ALTER TABLE movies ADD CONSTRAINT movies_release_year_check CHECK (release_year BETWEEN 1900 AND 2100);
ALTER TABLE episodes ADD CONSTRAINT episodes_number_check CHECK (number >= 1 AND season_number >= 1);
ALTER TABLE episodes ADD CONSTRAINT episodes_duration_check CHECK (duration_sec IS NULL OR duration_sec > 0);
ALTER TABLE watch_histories ADD CONSTRAINT watch_histories_progress_check CHECK (progress_sec >= 0);
ALTER TABLE danmakus ADD CONSTRAINT danmakus_time_check CHECK (time_ms >= 0);
ALTER TABLE danmakus ADD CONSTRAINT danmakus_content_check CHECK (length(btrim(content)) BETWEEN 1 AND 100);
ALTER TABLE comments ADD CONSTRAINT comments_content_check CHECK (length(btrim(content)) BETWEEN 1 AND 1000);
ALTER TABLE ratings ADD CONSTRAINT ratings_score_check CHECK (score BETWEEN 1 AND 5);
ALTER TABLE users ADD CONSTRAINT users_birth_year_check CHECK (birth_year BETWEEN 1900 AND 2100);
