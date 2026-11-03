import { spawn } from "node:child_process";
import { setDefaultResultOrder } from "node:dns";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";

const root = fileURLToPath(new URL("..", import.meta.url));
const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") throw new Error("Expected dev or start.");
process.chdir(root);
nextEnv.loadEnvConfig(root, mode === "dev");

let local;
if (!process.env.NETLIFY_DB_URL) {
  if (process.env.NETLIFY === "true") throw new Error("Netlify Database is not provisioned. Enable it before deploying.");
  setDefaultResultOrder("ipv4first");
  const { NetlifyDB } = await import("@netlify/database-dev");
  local = new NetlifyDB({ directory: process.env.TAKO_DEV_DB_DIR ?? path.join(root, "data", "postgres") });
  process.env.NETLIFY_DB_URL = await local.start();
  process.env.NETLIFY_DB_DRIVER = "server";
  await local.applyMigrations(path.join(root, "netlify", "database", "migrations"));
  console.log("[tako-jp] Local Postgres ready; Netlify credentials are not required.");
}

const args = process.argv.slice(3);
if (!args.includes("--port") && !args.includes("-p")) args.push("--port", "3107");
const next = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
const child = spawn(process.execPath, [next, mode, ...args], { stdio: "inherit", env: process.env });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill();
  await local?.stop();
}
process.on("SIGTERM", () => { void stop(); });
process.on("SIGINT", () => { void stop(); });
child.on("error", async (error) => {
  console.error("[tako-jp] Next.js could not start", error);
  await stop();
  process.exitCode = 1;
});
child.on("exit", async (code, signal) => {
  await stop();
  process.exitCode = code ?? (signal ? 1 : 0);
});
