import { test, expect } from "@playwright/test";

test("notes preload once and local navigation avoids per-note RSC requests", async ({ page }) => {
  const notesRequests: string[] = [];
  const rscRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/notes") notesRequests.push(request.url());
    if (url.searchParams.has("_rsc")) rscRequests.push(request.url());
  });
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/notes");
  await page.goto("/notes?level=N5");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
  expect(response.headers().etag).toBeTruthy();
  await expect(page.locator(".notes-workspace")).toHaveAttribute("data-notes-ready", "true");

  const reader = page.locator(".notes-preview .note-header h1");
  await expect(reader).toBeVisible();
  const firstTitle = await reader.innerText();
  const nextLink = page.locator(".notes-library-pane .lesson-card:not(.selected-note) a.note-inline-link").first();
  await expect(nextLink).toBeVisible();
  const nextId = await nextLink.getAttribute("data-book-target");
  expect(nextId).toBeTruthy();
  await nextLink.click();
  await expect(page.locator(`.notes-library-pane a.note-inline-link[data-book-target="${nextId}"]`)).toHaveAttribute("aria-current", "page");
  await expect(reader).not.toHaveText(firstTitle);
  expect(notesRequests).toHaveLength(1);
  expect(rscRequests).toEqual([]);

  await page.goBack();
  await expect(reader).toHaveText(firstTitle);
});

test("practice header and segmented progress remain interactive and accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/*.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto("/vocabulary/practice?level=N5");
  const back = page.getByRole("link", { name: "返回单词花园" });
  await expect(back).toBeVisible();
  const progress = page.getByRole("progressbar", { name: "抽背进度" });
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "下一个" }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  const ripple = page.locator("canvas.ripple-canvas");
  await expect(ripple).toHaveCount(1, { timeout: 5000 });
  await page.evaluate(() => {
    (window as Window & { rippleCanvas?: HTMLCanvasElement }).rippleCanvas =
      document.querySelector<HTMLCanvasElement>("canvas.ripple-canvas") ?? undefined;
  });
  await expect(ripple).toHaveCount(0, { timeout: 5000 });
  await page.getByRole("button", { name: "下一个" }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "3");
  await expect(ripple).toHaveCount(1, { timeout: 5000 });
  expect(await page.evaluate(() => (window as Window & { rippleCanvas?: HTMLCanvasElement }).rippleCanvas
    === document.querySelector("canvas.ripple-canvas"))).toBe(true);
  const restart = page.getByRole("link", { name: "重抽本轮" });
  expect(await restart.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(back).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
