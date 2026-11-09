import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { setDefaultResultOrder } from "node:dns";
import { NetlifyDB } from "@netlify/database-dev";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  clearAuthLimit, consumeAuthLimit, createSession, database, deleteSession,
  findUser, hashPassword, insertUser, loadProgress, saveAttempt, saveRead, sessionUser,
  transaction, verifyPassword, saveVocabularyAttempt,
} from "../src/lib/database.ts";
import { getCatalog, getQuiz } from "../src/lib/content.ts";
import { gradeQuiz } from "../src/lib/models.ts";
import { summarizeVocabularyAttempt } from "../src/lib/vocabulary-models.ts";
import { importSqlite } from "../scripts/import-sqlite.ts";

const local = new NetlifyDB();
before(async () => {
  setDefaultResultOrder("ipv4first");
  process.env.NETLIFY_DB_URL = await local.start();
  process.env.NETLIFY_DB_DRIVER = "server";
  await local.applyMigrations(path.join(process.cwd(), "netlify", "database", "migrations"));
});
after(async () => {
  await database().pool.end();
  await local.stop();
});

test("Postgres accounts, sessions, record isolation, idempotency and rollback", async () => {
  const encoded = await hashPassword("test-password-123");
  assert.equal(await verifyPassword("test-password-123", encoded), true);
  assert.equal(await verifyPassword("not-the-password", encoded), false);
  assert.ok(!encoded.includes("test-password"));
  const user = await insertUser("Tako_Test", encoded);
  const other = await insertUser("Other_Test", encoded);
  assert.ok(user && other);
  assert.equal((await findUser("tako_test"))?.id, user.id);
  assert.equal(await insertUser("TAKO_TEST", encoded), null);
  const token = await createSession(user.id);
  assert.equal((await sessionUser(token))?.id, user.id);
  assert.equal(await sessionUser("invalid"), null);
  const stored = await database().pool.query("SELECT token_hash FROM sessions");
  assert.notEqual(stored.rows[0]?.token_hash, token);
  await deleteSession(token);
  assert.equal(await sessionUser(token), null);
  const quiz = getQuiz(getCatalog().quizzes[0].id)!;
  const attempt = gradeQuiz(quiz, {
    id: randomUUID(), quizId: quiz.id, version: quiz.version, answers: quiz.questions.map((question) => question.answer),
    durationSeconds: 30, completedAt: "2026-01-01T10:00:00.000Z",
  });
  await saveAttempt(user.id, attempt);
  const repeated = await saveAttempt(user.id, { ...attempt, completedAt: "2026-01-02T10:00:00.000Z" });
  assert.equal(repeated.completedAt, attempt.completedAt);
  assert.equal((await loadProgress(user.id)).attempts.length, 1);
  assert.equal((await loadProgress(other.id)).attempts.length, 0);
  const vocabularyAttempt = summarizeVocabularyAttempt({
    id: randomUUID(), level: "N5", durationSeconds: 30, completedAt: new Date().toISOString(),
    answers: Array.from({ length: 10 }, (_, index) => ({ wordId: `word-${index}`, known: index < 6 })),
  });
  await saveVocabularyAttempt(user.id, vocabularyAttempt);
  const repeatedVocabulary = await saveVocabularyAttempt(user.id, { ...vocabularyAttempt, known: 0 });
  assert.equal(repeatedVocabulary.known, 6);
  assert.equal((await loadProgress(user.id)).vocabularyAttempts.length, 1);
  assert.equal((await loadProgress(other.id)).vocabularyAttempts.length, 0);
  await saveRead(user.id, { noteId: "note", readAt: "2026-01-02T10:00:00.000Z" });
  const older = await saveRead(user.id, { noteId: "note", readAt: "2026-01-01T10:00:00.000Z" });
  assert.equal(older.readAt, "2026-01-02T10:00:00.000Z");
  assert.equal((await loadProgress(user.id)).reads[0].readAt, "2026-01-02T10:00:00.000Z");
  await assert.rejects(transaction(async (client) => {
    await saveRead(user.id, { noteId: "rollback", readAt: new Date().toISOString() }, client);
    await saveVocabularyAttempt(user.id, { ...vocabularyAttempt, id: randomUUID() }, client);
    throw new Error("rollback");
  }), /rollback/);
  assert.equal((await loadProgress(user.id)).reads.length, 1);
  assert.equal((await loadProgress(user.id)).vocabularyAttempts.length, 1);
  for (let i = 0; i < 10; i++) assert.equal(await consumeAuthLimit("test-limit"), true);
  assert.equal(await consumeAuthLimit("test-limit"), false);
  await clearAuthLimit("test-limit");
  assert.equal(await consumeAuthLimit("test-limit"), true);
});

test("Postgres concurrent registration and rate limits remain atomic", async () => {
  const encoded = await hashPassword("test-password-123");
  const users = await Promise.all([insertUser("Concurrent", encoded), insertUser("CONCURRENT", encoded)]);
  assert.equal(users.filter(Boolean).length, 1);
  const allowed = await Promise.all(Array.from({ length: 15 }, () => consumeAuthLimit("concurrent-limit")));
  assert.equal(allowed.filter(Boolean).length, 10);
  await database().pool.query("UPDATE auth_limits SET reset_at = $1 WHERE key = $2", [Date.now() - 1, "concurrent-limit"]);
  assert.equal(await consumeAuthLimit("concurrent-limit"), true);
});

test("legacy SQLite import preserves credentials and records, is repeatable and rolls back conflicts", async () => {
  const parent = path.join(process.cwd(), "test-results");
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, "legacy-"));
  const filename = path.join(directory, "legacy.sqlite");
  const legacy = new DatabaseSync(filename);
  const id = randomUUID();
  const encoded = await hashPassword("legacy-password-123");
  const quiz = getQuiz(getCatalog().quizzes[0].id)!;
  const attempt = gradeQuiz(quiz, {
    id: randomUUID(), quizId: quiz.id, version: quiz.version, answers: Array(quiz.count).fill(null),
    durationSeconds: 30, completedAt: "2026-01-01T10:00:00.000Z",
  });
  legacy.exec(`
    CREATE TABLE users (id TEXT, username TEXT, username_key TEXT, password_hash TEXT, created_at TEXT);
    CREATE TABLE attempts (user_id TEXT, id TEXT, completed_at TEXT, payload TEXT);
    CREATE TABLE note_reads (user_id TEXT, note_id TEXT, read_at TEXT);
  `);
  legacy.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run(id, "Legacy", "legacy", encoded, attempt.completedAt);
  legacy.prepare("INSERT INTO attempts VALUES (?, ?, ?, ?)").run(id, attempt.id, attempt.completedAt, JSON.stringify(attempt));
  legacy.prepare("INSERT INTO note_reads VALUES (?, ?, ?)").run(id, "legacy-note", attempt.completedAt);
  legacy.close();
  try {
    assert.deepEqual(await importSqlite(filename), { users: 1, attempts: 1, reads: 1 });
    await importSqlite(filename);
    assert.equal((await loadProgress(id)).attempts.length, 1);
    assert.equal((await loadProgress(id)).reads.length, 1);
    assert.equal(await verifyPassword("legacy-password-123", (await findUser("Legacy"))!.password_hash), true);
    const changed = new DatabaseSync(filename);
    changed.prepare("UPDATE users SET password_hash = ?").run(await hashPassword("different-password"));
    changed.close();
    await assert.rejects(importSqlite(filename), /differs from the target/);
    assert.equal(await verifyPassword("legacy-password-123", (await findUser("Legacy"))!.password_hash), true);
    assert.equal((await loadProgress(id)).attempts.length, 1);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
