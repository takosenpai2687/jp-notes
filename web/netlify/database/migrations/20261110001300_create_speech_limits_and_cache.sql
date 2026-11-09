CREATE TABLE speech_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);
CREATE INDEX speech_limit_expiry ON speech_limits(reset_at);

CREATE TABLE speech_cache (
  key TEXT PRIMARY KEY,
  audio BYTEA NOT NULL,
  bytes INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX speech_cache_created ON speech_cache(created_at);
