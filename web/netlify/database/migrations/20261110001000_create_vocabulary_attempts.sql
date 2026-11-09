CREATE TABLE vocabulary_attempts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX vocabulary_attempts_user_date ON vocabulary_attempts(user_id, completed_at DESC);
