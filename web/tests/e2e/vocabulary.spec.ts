import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getVocabulary } from "../../src/lib/vocabulary";
import { initialKana } from "../../src/lib/vocabulary-models";

test("vocabulary browses five-sound groups, searches and shows English definitions and readings on desktop and phone", async ({ page }) => {
  const words = getVocabulary("N5");
  const selected = words.find((word) => word.word === "会う")!;
  await page.goto("/vocabulary?level=N5");
  const list = page.getByRole("region", { name: "单词列表" });
  const detail = page.getByRole("region", { name: "单词内容" });
  await expect(page.locator(".vocab-workspace")).toHaveCount(1);
  await expect(list).toBeVisible();
  await expect(detail).toBeVisible();
  await expect(list.getByRole("button", { name: "あ", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(list.locator(".vocab-row")).toHaveCount(Math.min(20, words.filter((word) => initialKana(word.reading) === "あ").length));
  await expect(list.getByRole("table", { name: "清音五十音目录" }).getByRole("columnheader")).toHaveText(["あ", "い", "う", "え", "お"]);
  const boxes = await Promise.all([list.boundingBox(), detail.boundingBox()]);
  expect(boxes[0]!.width).toBeLessThanOrEqual(250);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThan(boxes[1]!.x);
  await list.getByRole("button", { name: "き", exact: true }).click();
  const rowReadings = await list.locator(".vocab-row > span").allTextContents();
  expect(rowReadings.length).toBeGreaterThan(0);
  expect(rowReadings.every((reading) => initialKana(reading) === "き")).toBe(true);
  await list.getByRole("tab", { name: "浊音", exact: true }).click();
  await list.getByRole("button", { name: "が", exact: true }).click();
  expect((await list.locator(".vocab-row > span").allTextContents()).every((reading) => initialKana(reading) === "が")).toBe(true);
  await list.locator(".kana-directory summary").click();
  await expect(list.getByRole("table", { name: "浊音五十音目录" })).toBeHidden();
  await list.locator(".kana-directory summary").click();
  await list.getByRole("button", { name: "全部", exact: true }).click();
  await expect(list.locator(".vocab-row")).toHaveCount(20);
  await expect(list.locator(".vocab-row-index").first()).toHaveText("1");
  await expect(list.getByRole("button", { name: "上一页单词" })).toBeDisabled();
  await list.getByRole("button", { name: "下一页单词" }).click();
  await expect(list.locator(".vocab-row")).toHaveCount(20);
  await expect(list.locator(".vocab-row-index").first()).toHaveText("21");
  await expect(list.getByRole("navigation", { name: "单词列表分页" })).toContainText("2 / 34");
  await list.getByRole("textbox", { name: "搜索单词" }).fill("会う");
  await expect(list.locator(".vocab-row-index").first()).toHaveText("1");
  await expect(list.getByRole("button", { name: "下一页单词" })).toBeDisabled();
  const wordNavigationRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.has("_rsc")) wordNavigationRequests.push(request.url());
  });
  await list.getByRole("link").filter({ hasText: "会う" }).click();
  await expect(page).toHaveURL(new RegExp(`word=${selected.id}`));
  expect(wordNavigationRequests).toEqual([]);
  await expect(detail.getByRole("heading", { name: "会う", exact: true })).toBeVisible();
  await expect(detail.locator(".vocab-reading")).toHaveText("あう");
  await expect(detail.locator(".vocab-romaji")).toHaveText("au");
  await expect(detail.locator(".vocab-pos")).toContainText("1类动词");
  await expect(detail.locator(".vocab-pos")).not.toContainText("五段动词");
  await expect(detail.getByRole("region", { name: "英文释义" })).toContainText(selected.meanings[0]);
  await expect(detail.locator(".vocab-example").first()).toContainText(selected.examples[0].en);
  await expect(detail.locator("ruby").first()).toBeVisible();
  await list.getByRole("textbox", { name: "搜索单词" }).fill("没有这个单词abcdefgh");
  await expect(list).toContainText("没有找到单词");
  await list.getByRole("button", { name: "清空搜索" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(list).toBeHidden();
  await expect(detail).toBeVisible();
  await page.getByRole("link", { name: "返回单词列表" }).click();
  await expect(list).toBeVisible();
  await expect(detail).toBeHidden();
  await list.getByRole("tab", { name: "清音", exact: true }).click();
  await list.getByRole("button", { name: "い", exact: true }).click();
  expect((await list.locator(".vocab-row > span").allTextContents()).every((reading) => initialKana(reading) === "い")).toBe(true);
  await list.getByRole("textbox", { name: "搜索单词" }).fill(selected.meanings[0]);
  await list.getByRole("link").filter({ hasText: "会う" }).click();
  await expect(detail).toBeVisible();
  await page.goBack();
  await expect(list).toBeVisible();
  await page.goto("/vocabulary?level=N4");
  await expect(list.getByRole("status")).toContainText("630");
  for (const level of ["N3", "N2", "N1"] as const) {
    await page.goto(`/vocabulary?level=${level}`);
    await expect(page.locator(".vocab-workspace")).toHaveCount(1);
    await expect(list.getByRole("status")).toContainText(String(getVocabulary(level).length));
    await page.goto(`/vocabulary/practice?level=${level}`);
    await expect(page.locator(".vocab-flashcard")).toHaveCount(1);
  }
  for (const path of ["/vocabulary?level=nope", "/vocabulary?level=N5&word=missing", "/vocabulary?level=N5&word=", "/vocabulary?level=N5&level=N4"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "这座小岛，还没出现在地图上" })).toBeVisible();
    await expect(page.locator(".vocab-workspace")).toHaveCount(0);
  }
});

test("guest practice hides readings until reveal, saves ten unique self-ratings and merges them into the account", async ({ page, browser }) => {
  await page.goto("/vocabulary/practice?level=N5");
  const seen = new Set<string>();
  const names: string[] = [];
  for (let index = 0; index < 10; index++) {
    await expect(page.locator(".vocab-round-progress")).toContainText(`第 ${index + 1} / 10 词`);
    await expect(page.locator(".vocab-reading")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "认识", exact: true })).toHaveCount(0);
    const word = await page.locator(".vocab-prompt h2").innerText();
    names.push(word);
    await page.getByRole("button", { name: "查看读音", exact: true }).click();
    await expect(page.locator(".vocab-reading")).toBeVisible();
    if (index === 0) {
      await expect(page.getByRole("button", { name: "隐藏读音", exact: true })).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#practice-reading > div")).toHaveCSS("opacity", "1");
      const fade = await page.evaluate(async () => {
        const values: number[] = [];
        const start = performance.now();
        document.querySelector<HTMLButtonElement>("button[aria-controls='practice-reading']")!.click();
        return new Promise<{ values: number[]; elapsed: number }>((resolve) => {
          function measure() {
            const reading = document.querySelector("#practice-reading > div:has(.vocab-reading)");
            if (!reading) return resolve({ values, elapsed: performance.now() - start });
            values.push(Number(getComputedStyle(reading).opacity));
            requestAnimationFrame(measure);
          }
          requestAnimationFrame(measure);
        });
      });
      expect(fade.values.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
      expect(fade.elapsed).toBeGreaterThanOrEqual(100);
      expect(fade.elapsed).toBeLessThan(1500);
      await expect(page.locator(".vocab-reading")).toHaveCount(0);
      await page.getByRole("button", { name: "查看读音", exact: true }).click();
      await expect(page.locator(".vocab-reading")).toBeVisible();
    }
    await page.getByRole("button", { name: index % 2 ? "认识" : "不认识", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "这一轮，认识了 5 / 10 个词" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("本轮记录已保存");
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem("tako-jp:guest:v1")!));
  const attempt = raw.vocabularyAttempts[0];
  for (const answer of attempt.answers) seen.add(answer.wordId);
  expect(seen.size).toBe(10);
  expect(attempt.known).toBe(5);
  await page.getByRole("link", { name: "查看学习足迹" }).click();
  await expect(page.getByRole("region", { name: "单词抽背记录" })).toContainText("认识 5 / 10");
  await page.reload();
  await expect(page.getByRole("region", { name: "单词抽背记录" })).toContainText(names[0]);
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "还没有护照？免费注册" }).click();
  await page.getByLabel("用户名", { exact: true }).fill(`vocab_${randomUUID().slice(0, 8)}`);
  await page.getByLabel(/密码 至少/).fill("a-strong-test-password");
  await page.getByLabel("确认密码", { exact: true }).fill("a-strong-test-password");
  await page.getByRole("button", { name: "创建账号，开启旅程" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const remote = await (await page.request.get("/api/progress")).json();
  expect(remote.vocabularyAttempts).toHaveLength(1);
  const origin = "http://127.0.0.1:3108";
  const post = (body: unknown) => page.request.post("/api/progress", { headers: { Origin: origin }, data: body });
  expect((await post({ type: "vocabulary", attempt: { ...attempt, known: 10 } })).ok()).toBe(true);
  expect((await (await page.request.get("/api/progress")).json()).vocabularyAttempts).toHaveLength(1);
  expect((await post({ type: "vocabulary", attempt: { ...attempt, id: randomUUID(), level: "N3" } })).status()).toBe(400);
  expect((await post({ type: "vocabulary", attempt: { ...attempt, id: randomUUID(), answers: Array(10).fill(attempt.answers[0]) } })).status()).toBe(400);
  expect((await post({ type: "vocabulary", attempt: { ...attempt, id: randomUUID(), answers: attempt.answers.map((answer: { known: boolean }) => ({ ...answer, wordId: "missing" })) } })).status()).toBe(400);
  const forged = await post({ type: "vocabulary", attempt: { ...attempt, id: randomUUID(), answers: attempt.answers.map((answer: { wordId: string }) => ({ ...answer, known: false })), known: 10 } });
  expect((await forged.json()).attempt.known).toBe(0);
  const other = await browser.newContext();
  const registered = await other.request.post(`${origin}/api/auth/register`, { headers: { Origin: origin }, data: { username: `vocab_${randomUUID().slice(0, 8)}`, password: "a-strong-test-password" } });
  expect(registered.ok()).toBe(true);
  expect((await (await other.request.get(`${origin}/api/progress`)).json()).vocabularyAttempts).toHaveLength(0);
  await other.close();
});

test("short-screen and reduced-motion reading toggles remain reachable and do not show stale readings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/vocabulary/practice?level=N5");
  await page.getByRole("button", { name: "查看读音", exact: true }).click();
  await expect(page.locator(".vocab-reading")).toBeVisible();
  await page.getByRole("button", { name: "隐藏读音", exact: true }).click();
  await expect(page.locator(".vocab-reading")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "查看读音", exact: true }).click();
  await expect(page.locator(".vocab-reading")).toBeVisible();
  await expect(page.locator("#practice-reading > div")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "认识", exact: true }).click();
  await expect(page.locator(".vocab-round-progress")).toContainText("第 2 / 10 词");
  await expect(page.locator(".vocab-reading")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("failed account save leaves a retryable result without duplicate records", async ({ page }) => {
  const origin = "http://127.0.0.1:3108";
  await page.request.post("/api/auth/register", { headers: { Origin: origin }, data: { username: `retry_${randomUUID().slice(0, 8)}`, password: "a-strong-test-password" } });
  await page.goto("/vocabulary/practice?level=N4");
  let fail = true;
  await page.route("**/api/progress", async (route) => {
    if (fail && route.request().method() === "POST") {
      await route.fulfill({ status: 503, json: { error: "测试保存失败" } });
    } else await route.continue();
  });
  for (let index = 0; index < 10; index++) {
    await page.getByRole("button", { name: "查看读音", exact: true }).click();
    await page.getByRole("button", { name: "认识", exact: true }).click();
  }
  await expect(page.locator(".inline-error[role=alert]")).toContainText("测试保存失败");
  await expect(page.getByRole("status")).toHaveText("本轮记录尚未保存");
  fail = false;
  await page.getByRole("button", { name: "重试保存" }).click();
  await expect(page.getByRole("status")).toHaveText("本轮记录已保存");
  expect((await (await page.request.get("/api/progress")).json()).vocabularyAttempts).toHaveLength(1);
});
