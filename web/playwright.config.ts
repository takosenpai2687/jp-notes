import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const mode = process.env.TAKO_E2E_PRODUCTION === "1" ? "start" : "dev";

export default defineConfig({
  testDir: ".\\tests\\e2e",
  outputDir: ".\\test-results\\artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3108",
    ...devices["Desktop Edge"], channel: "msedge",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts\\serve.mjs ${mode} --port 3108 --hostname 127.0.0.1`,
    url: "http://127.0.0.1:3108",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: "1", NETLIFY: "false", NETLIFY_DB_URL: "", TAKO_DEV_DB_DIR: path.join(process.cwd(), "test-results", "e2e-postgres") },
  },
});
