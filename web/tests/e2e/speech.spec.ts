import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getVocabulary } from "../../src/lib/vocabulary";

test.beforeEach(async ({ page, baseURL }) => {
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: baseURL! },
    data: { username: `speech_${randomUUID().slice(0, 8)}`, password: "speech-test-password" },
  });
  expect(response.ok()).toBe(true);
});

function silentWav(seconds = 5) {
  const rate = 8000, size = rate * seconds * 2;
  const buffer = Buffer.alloc(44 + size);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + size, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(size, 40);
  return buffer;
}

test("reading and example speakers send catalog identifiers, play exclusively, stop and reuse audio", async ({ page }) => {
  const word = getVocabulary("N5").find((item) => item.word === "会う")!;
  const requests: unknown[] = [];
  await page.route("**/api/speech?*", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    requests.push({
      level: query.get("level"), wordId: query.get("wordId"), kind: query.get("kind"),
      ...(query.has("exampleId") ? { exampleId: Number(query.get("exampleId")) } : {}),
    });
    await route.fulfill({ contentType: "audio/wav", body: silentWav() });
  });
  await page.goto(`/vocabulary?level=N5&word=${word.id}`);
  const detail = page.getByRole("region", { name: "单词内容" });
  const reading = detail.locator(".vocab-reading-line .speech-button");
  const example = detail.locator(".vocab-example .speech-button").first();
  await expect(reading).toHaveAttribute("aria-label", "播放会う的读音");
  expect(requests).toHaveLength(0);
  await reading.focus();
  await page.keyboard.press("Enter");
  await expect(reading).toHaveAttribute("data-state", "playing");
  expect(requests[0]).toEqual({ level: "N5", wordId: word.id, kind: "reading" });
  await example.click();
  await expect(example).toHaveAttribute("data-state", "playing");
  await expect(reading).toHaveAttribute("data-state", "idle");
  expect(requests[1]).toEqual({ level: "N5", wordId: word.id, kind: "example", exampleId: word.examples[0].tatoeba_id });
  await example.click();
  await expect(example).toHaveAttribute("data-state", "idle");
  await reading.click();
  await expect(reading).toHaveAttribute("data-state", "playing");
  expect(requests).toHaveLength(2);
  await reading.click();
  await expect(reading).toHaveAttribute("data-state", "idle");
  await reading.click();
  await expect(reading).toHaveAttribute("data-state", "playing");
  await expect(reading).toHaveAttribute("data-state", "idle", { timeout: 10_000 });
});

test("speaker exposes retryable backend and invalid-audio errors without fake playback", async ({ page }) => {
  let mode = "missing";
  await page.route("**/api/speech?*", async (route) => {
    if (mode === "missing") return route.fulfill({ status: 404, json: { error: "这个词已不在词库中。" } });
    if (mode === "quota") return route.fulfill({ status: 429, json: { error: "发音额度不足，请稍后再试。" } });
    if (mode === "json") return route.fulfill({ json: { audio: "not binary" } });
    await route.fulfill({ contentType: "audio/wav", body: silentWav() });
  });
  await page.goto("/vocabulary?level=N5");
  const speaker = page.getByRole("region", { name: "单词内容" }).locator(".vocab-reading-line .speech-button");
  await speaker.click();
  await expect(speaker).toHaveAttribute("data-state", "error");
  await expect(page.getByText("这个词已不在词库中。", { exact: true })).toBeVisible();
  mode = "quota";
  await speaker.click();
  await expect(page.getByText("发音额度不足，请稍后再试。", { exact: true })).toBeVisible();
  mode = "json";
  await speaker.click();
  await expect(page.getByText("发音服务返回的不是可播放音频。", { exact: true })).toBeVisible();
  mode = "audio";
  await speaker.click();
  await expect(speaker).toHaveAttribute("data-state", "playing");
});

test("practice speaker stays hidden until reveal, cancels loading and stops when hidden or navigated", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let delay = false;
  let requested = 0;
  await page.route("**/api/speech?*", async (route) => {
    requested++;
    if (delay) await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ contentType: "audio/wav", body: silentWav() });
  });
  await page.goto("/vocabulary/practice?level=N5");
  await expect(page.locator(".speech-button")).toHaveCount(0);
  expect(requested).toBe(0);
  await page.getByRole("button", { name: "查看读音", exact: true }).click();
  const speaker = page.locator(".speech-button");
  delay = true;
  await speaker.click();
  await expect(speaker).toHaveAttribute("data-state", "loading");
  await speaker.click();
  await expect(speaker).toHaveAttribute("data-state", "idle");
  delay = false;
  await speaker.click();
  await expect(speaker).toHaveAttribute("data-state", "playing");
  await expect(speaker.locator(".speech-wave").first()).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "隐藏读音", exact: true }).click();
  await expect(speaker).toHaveCount(0);
  await page.getByRole("button", { name: "查看读音", exact: true }).click();
  await speaker.click();
  await expect(speaker).toHaveAttribute("data-state", "playing");
  await page.getByRole("link", { name: "返回单词花园", exact: true }).click();
  await expect(page.locator(".vocab-workspace")).toHaveCount(1);
  await expect(page.locator(".speech-playing")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
