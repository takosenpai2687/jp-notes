import { getDatabase } from "@netlify/database";
import type { QueryResultRow } from "pg";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { attemptSchema } from "./models.ts";
import type { Attempt, NoteRead, Progress, User } from "./models.ts";
import { vocabularyAttemptSchema } from "./vocabulary-models.ts";
import type { VocabularyAttempt } from "./vocabulary-models.ts";

export interface DatabaseClient {
  query<Row extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}
interface DatabasePool extends DatabaseClient {
  connect(): Promise<DatabaseClient & { release(): void }>;
  end(): Promise<void>;
}
let connection: { pool: DatabasePool } | undefined;
export function database() {
  connection ??= { pool: getDatabase().pool };
  return connection;
}

function deriveKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key));
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await deriveKey(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  const key = await deriveKey(password, salt);
  const expected = Buffer.from(hash, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export const usernameKey = (name: string) => name.normalize("NFC").toLocaleLowerCase("en-US");

export async function findUser(name: string) {
  const { rows } = await database().pool.query<{ id: string; username: string; password_hash: string }>(
    "SELECT id, username, password_hash FROM users WHERE username_key = $1", [usernameKey(name)],
  );
  return rows[0];
}
export async function insertUser(username: string, passwordHash: string): Promise<User | null> {
  const user = { id: randomUUID(), username };
  const { rows } = await database().pool.query<User>(
    `INSERT INTO users (id, username, username_key, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (username_key) DO NOTHING RETURNING id, username`,
    [user.id, user.username, usernameKey(username), passwordHash, new Date().toISOString()],
  );
  return rows[0] ?? null;
}

const digestToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const sessionSeconds = 60 * 60 * 24 * 30;
export async function createSession(userId: string) {
  const pool = database().pool;
  await pool.query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
  const token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [digestToken(token), userId, Date.now() + sessionSeconds * 1000]);
  return token;
}
export async function sessionUser(token: string): Promise<User | null> {
  const { rows } = await database().pool.query<User>(`
    SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = $1 AND sessions.expires_at > $2
  `, [digestToken(token), Date.now()]);
  return rows[0] ?? null;
}
export async function deleteSession(token: string) {
  await database().pool.query("DELETE FROM sessions WHERE token_hash = $1", [digestToken(token)]);
}

export async function consumeAuthLimit(key: string) {
  const pool = database().pool;
  const now = Date.now();
  await pool.query("DELETE FROM auth_limits WHERE reset_at < $1", [now]);
  const { rows } = await pool.query<{ count: number }>(`
    INSERT INTO auth_limits(key, count, reset_at) VALUES ($1, 1, $2)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN auth_limits.reset_at <= $3 THEN 1 ELSE auth_limits.count + 1 END,
      reset_at = CASE WHEN auth_limits.reset_at <= $3 THEN EXCLUDED.reset_at ELSE auth_limits.reset_at END
    RETURNING count
  `, [key, now + 15 * 60 * 1000, now]);
  if (!rows[0]) throw new Error("Authentication rate limit was not recorded.");
  return rows[0].count <= 10;
}
export async function clearAuthLimit(key: string) {
  await database().pool.query("DELETE FROM auth_limits WHERE key = $1", [key]);
}

export async function saveAttempt(userId: string, attempt: Attempt, client: DatabaseClient = database().pool) {
  await client.query(`INSERT INTO attempts (user_id, id, completed_at, payload) VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, id) DO NOTHING`, [userId, attempt.id, attempt.completedAt, JSON.stringify(attempt)]);
  const { rows } = await client.query<{ payload: string }>(
    "SELECT payload FROM attempts WHERE user_id = $1 AND id = $2", [userId, attempt.id],
  );
  const saved = rows[0];
  if (!saved) throw new Error("Saved attempt could not be read back.");
  return attemptSchema.parse(JSON.parse(saved.payload));
}
export async function saveRead(userId: string, read: NoteRead, client: DatabaseClient = database().pool): Promise<NoteRead> {
  const { rows } = await client.query<{ note_id: string; read_at: string }>(`
    INSERT INTO note_reads (user_id, note_id, read_at) VALUES ($1, $2, $3)
    ON CONFLICT(user_id, note_id) DO UPDATE SET read_at = GREATEST(note_reads.read_at, EXCLUDED.read_at)
    RETURNING note_id, read_at
  `, [userId, read.noteId, read.readAt]);
  if (!rows[0]) throw new Error("Saved reading record could not be read back.");
  return { noteId: rows[0].note_id, readAt: rows[0].read_at };
}
// Speech synthesis cost protection: a DB-backed rate limit and bounded audio
// cache so multiple serverless instances share one quota guard. The cache is
// intentionally bounded and time-limited (never a permanent redistribution
// store); Youdao's terms restrict caching service data, so keep these caps
// modest and re-synthesize after the TTL rather than serving audio forever.
const speechRateWindowMs = 15 * 60 * 1000;
const speechRateLimit = 60;
const speechCacheMaxEntries = 2000;
const speechCacheMaxBytes = 32 * 1024 * 1024;
const speechCacheTtlMs = 7 * 24 * 60 * 60 * 1000;

export async function consumeSpeechLimit(key: string) {
  const pool = database().pool;
  const now = Date.now();
  await pool.query("DELETE FROM speech_limits WHERE reset_at < $1", [now]);
  const { rows } = await pool.query<{ count: number }>(`
    INSERT INTO speech_limits(key, count, reset_at) VALUES ($1, 1, $2)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN speech_limits.reset_at <= $3 THEN 1 ELSE speech_limits.count + 1 END,
      reset_at = CASE WHEN speech_limits.reset_at <= $3 THEN EXCLUDED.reset_at ELSE speech_limits.reset_at END
    RETURNING count
  `, [key, now + speechRateWindowMs, now]);
  if (!rows[0]) throw new Error("Speech rate limit was not recorded.");
  return rows[0].count <= speechRateLimit;
}

export async function loadSpeechCache(key: string): Promise<Buffer | null> {
  const { rows } = await database().pool.query<{ audio: Buffer }>(
    "SELECT audio FROM speech_cache WHERE key = $1 AND created_at > $2",
    [key, Date.now() - speechCacheTtlMs],
  );
  return rows[0]?.audio ?? null;
}

export async function saveSpeechCache(key: string, audio: Buffer) {
  const pool = database().pool;
  await pool.query(`
    INSERT INTO speech_cache(key, audio, bytes, created_at) VALUES ($1, $2, $3, $4)
    ON CONFLICT(key) DO UPDATE SET audio = EXCLUDED.audio, bytes = EXCLUDED.bytes, created_at = EXCLUDED.created_at
  `, [key, audio, audio.byteLength, Date.now()]);
  await pool.query(`
    WITH ranked AS (
      SELECT key, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn,
             SUM(bytes) OVER (ORDER BY created_at DESC) AS running_bytes
      FROM speech_cache
    )
    DELETE FROM speech_cache WHERE key IN (
      SELECT key FROM ranked WHERE rn > $1 OR running_bytes > $2
    )
  `, [speechCacheMaxEntries, speechCacheMaxBytes]);
}

export async function saveVocabularyAttempt(userId: string, attempt: VocabularyAttempt, client: DatabaseClient = database().pool) {
  await client.query(`INSERT INTO vocabulary_attempts (user_id, id, completed_at, payload) VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, id) DO NOTHING`, [userId, attempt.id, attempt.completedAt, JSON.stringify(attempt)]);
  const { rows } = await client.query<{ payload: string }>(
    "SELECT payload FROM vocabulary_attempts WHERE user_id = $1 AND id = $2", [userId, attempt.id],
  );
  if (!rows[0]) throw new Error("Saved vocabulary attempt could not be read back.");
  return vocabularyAttemptSchema.parse(JSON.parse(rows[0].payload));
}
export async function loadProgress(userId: string, client: DatabaseClient = database().pool): Promise<Progress> {
  const [attempts, reads, vocabulary] = await Promise.all([
    client.query<{ payload: string }>("SELECT payload FROM attempts WHERE user_id = $1 ORDER BY completed_at DESC", [userId]),
    client.query<{ note_id: string; read_at: string }>("SELECT note_id, read_at FROM note_reads WHERE user_id = $1 ORDER BY read_at DESC", [userId]),
    client.query<{ payload: string }>("SELECT payload FROM vocabulary_attempts WHERE user_id = $1 ORDER BY completed_at DESC", [userId]),
  ]);
  return {
    attempts: attempts.rows.map((row) => attemptSchema.parse(JSON.parse(row.payload))),
    reads: reads.rows.map((row) => ({ noteId: row.note_id, readAt: row.read_at })),
    vocabularyAttempts: vocabulary.rows.map((row) => vocabularyAttemptSchema.parse(JSON.parse(row.payload))),
  };
}
export async function transaction<T>(job: (client: DatabaseClient) => Promise<T>): Promise<T> {
  const client = await database().pool.connect();
  try {
    await client.query("BEGIN");
    const value = await job(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], "Database transaction and rollback failed."); }
    throw error;
  } finally {
    client.release();
  }
}
