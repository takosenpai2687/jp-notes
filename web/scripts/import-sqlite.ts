import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { z } from "zod";
import { database, saveAttempt, saveRead, transaction } from "../src/lib/database.ts";
import { attemptSchema, readSchema } from "../src/lib/models.ts";

const userSchema = z.object({
  id: z.string().min(1), username: z.string().min(1), username_key: z.string().min(1),
  password_hash: z.string().regex(/^[a-f0-9]{32}:[a-f0-9]{128}$/), created_at: z.iso.datetime(),
});
const legacyAttemptSchema = z.object({
  user_id: z.string(), id: z.string(), completed_at: z.string(), payload: z.string(),
});
const legacyReadSchema = z.object({ user_id: z.string(), note_id: z.string(), read_at: z.string() });

export async function importSqlite(filename: string) {
  const source = new DatabaseSync(path.resolve(filename), { readOnly: true });
  let users: z.infer<typeof userSchema>[];
  let attempts: z.infer<typeof legacyAttemptSchema>[];
  let reads: z.infer<typeof legacyReadSchema>[];
  try {
    source.exec("BEGIN");
    users = z.array(userSchema).parse(source.prepare("SELECT * FROM users").all());
    attempts = z.array(legacyAttemptSchema).parse(source.prepare("SELECT * FROM attempts").all());
    reads = z.array(legacyReadSchema).parse(source.prepare("SELECT * FROM note_reads").all());
    source.exec("COMMIT");
  } finally {
    source.close();
  }
  await transaction(async (client) => {
    for (const user of users) {
      await client.query(`INSERT INTO users (id, username, username_key, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [user.id, user.username, user.username_key, user.password_hash, user.created_at]);
      const { rows } = await client.query<{ username_key: string; password_hash: string }>(
        "SELECT username_key, password_hash FROM users WHERE id = $1", [user.id],
      );
      if (rows[0]?.username_key !== user.username_key || rows[0]?.password_hash !== user.password_hash) {
        throw new Error(`Account ${user.id} differs from the target. Import rolled back; no accounts were overwritten.`);
      }
    }
    for (const row of attempts) {
      const attempt = attemptSchema.parse(JSON.parse(row.payload));
      if (attempt.id !== row.id || attempt.completedAt !== row.completed_at) throw new Error(`Attempt ${row.id} has inconsistent metadata.`);
      await saveAttempt(row.user_id, attempt, client);
    }
    for (const row of reads) {
      await saveRead(row.user_id, readSchema.parse({ noteId: row.note_id, readAt: row.read_at }), client);
    }
  });
  return { users: users.length, attempts: attempts.length, reads: reads.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  nextEnv.loadEnvConfig(process.cwd());
  try {
    if (!process.env.NETLIFY_DB_URL) throw new Error("Set NETLIFY_DB_URL to the intended target database before importing.");
    if (!process.argv[2]) throw new Error("Usage: npm run db:import:sqlite -- <existing SQLite file>");
    console.log("[tako-jp] Import processed successfully:", await importSqlite(process.argv[2]));
    console.log("[tako-jp] Password hashes preserved. Existing sessions were not imported; sign in again.");
  } catch (error) {
    console.error("[tako-jp] Import failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    if (process.env.NETLIFY_DB_URL) await database().pool.end();
  }
}
