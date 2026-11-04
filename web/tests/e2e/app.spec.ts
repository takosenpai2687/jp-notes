import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getCatalog, getQuiz, loadContent, noteUrl } from "../../src/lib/content";
import { gradeQuiz } from "../../src/lib/models";

const origin = "http://127.0.0.1:3108";
const catalog = getCatalog();
const quiz = getQuiz(catalog.quizzes.find((item) => item.level === "N5")!.id)!;

test("analytics is opt-in and initializes only once across client navigations", async ({ page }) => {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  let scriptLoads = 0;
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    scriptLoads++;
    await route.fulfill({ contentType: "application/javascript", body: "" });
  });
  await page.route(/https:\/\/[^/]*google-analytics\.com\//, (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#main-content")).toBeVisible();
  if (measurementId) {
    await expect(page.locator("script#tako-ga-loader")).toHaveAttribute(
      "src", `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
    );
    await expect.poll(() => page.evaluate(() => JSON.stringify(Reflect.get(window, "dataLayer")))).toContain(
      JSON.stringify({
        0: "config", 1: measurementId,
        2: { allow_google_signals: false, allow_ad_personalization_signals: false },
      }),
    );
    await expect.poll(() => scriptLoads).toBe(1);
  }
  await page.getByRole("link", { name: "笔记森林，N5" }).click();
  await expect(page).toHaveURL(/\/notes\?level=N5$/);
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.locator("script#tako-ga-init")).toHaveCount(measurementId ? 1 : 0);
  await expect(page.locator("script#tako-ga-loader")).toHaveCount(measurementId ? 1 : 0);
  expect(scriptLoads).toBe(measurementId ? 1 : 0);
  if (measurementId) {
    const configCount = await page.evaluate(() => {
      const entries: unknown[] = Reflect.get(window, "dataLayer");
      return entries.filter((entry) => typeof entry === "object" && entry !== null && "0" in entry && entry[0] === "config").length;
    });
    expect(configCount).toBe(1);
  } else {
    expect(await page.evaluate(() => "dataLayer" in window)).toBe(false);
  }
});

test("blocked analytics does not prevent learning navigation", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_GA_ID?.trim(), "Analytics is not configured.");
  await page.route(/https:\/\/(www\.googletagmanager\.com|[^/]*google-analytics\.com)\//, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("link", { name: "语法试炼，N5" }).click();
  await expect(page).toHaveURL(/\/quiz\?level=N5$/);
  await expect(page.locator(".lesson-card")).not.toHaveCount(0);
});

test("four islands, level selection, honest unavailable levels and coming soon", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /今天，想去哪座.*岛/ })).toBeVisible();
  await expect(page.locator(".island-card")).toHaveCount(4);
  await expect(page.locator(".island-card")).toHaveClass([
    /island-notes/, /island-quiz/, /island-vocabulary/, /island-exams/,
  ]);
  await expect(page.locator(".sidebar .tako-logo")).toBeVisible();
  await expect(page.locator(".home-cloud .cloud-note")).toHaveText("いっしょに、行こう！");
  await expect(page.locator(".home-cloud .cloud-friend")).toBeVisible();
  await page.locator(".level-stop").filter({ hasText: "N4" }).click();
  await expect(page.getByRole("link", { name: "语法试炼，N4" })).toHaveAttribute("href", "/quiz?level=N4");
  await page.getByRole("link", { name: "语法试炼，N4" }).click();
  await expect(page.locator(".lesson-card")).toHaveCount(catalog.quizzes.filter((item) => item.level === "N4").length);
  await page.locator(".level-tab").filter({ hasText: "N1" }).click();
  await expect(page.getByRole("heading", { name: "N1 的航线，还在绘制中" })).toBeVisible();
  for (const section of ["exams", "vocabulary"]) {
    await page.goto(`/${section}?level=N2`);
    await expect(page.getByText("COMING SOON", { exact: true })).toBeVisible();
    await expect(page.locator(".level-tab.selected")).toContainText("N2");
  }
  expect(errors).toEqual([]);
});

test("feature pages share compact headers and descriptive level tabs without summaries", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const sizes = [];
    for (const [section, title] of [["notes", "笔记森林"], ["quiz", "语法试炼"], ["exams", "真题远征"], ["vocabulary", "单词花园"]]) {
      await page.goto(`/${section}?level=N5`);
      const heading = page.locator(".library-heading");
      await expect(heading).toHaveCount(1);
      await expect(heading.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(page.locator(".level-tab")).toHaveText(["N5入门", "N4基础", "N3进阶", "N2熟练", "N1精通"]);
      await expect(page.locator(".library-summary")).toHaveCount(0);
      sizes.push(await heading.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)));
      expect(await heading.locator(".page-stamp").evaluate((el) => parseFloat(getComputedStyle(el).height))).toBe(64);
      if (section === "notes") {
        await expect(heading).toContainText("読むたびに、景色が変わる。");
        await expect(heading).toContainText("让语法不再是需要记住的规则，而是慢慢读懂的风景。");
      }
    }
    expect(new Set(sizes).size).toBe(1);
    expect(sizes[0]).toBeLessThanOrEqual(28);
  }
});

test("notes rows grow with three-line N4 titles instead of shrinking or overlapping", async ({ page }) => {
  const title = "N4 推量四件套总结：ようだ・みたいだ・そうだ・らしい";
  await page.goto("/notes?level=N4");
  await page.evaluate(() => document.fonts.ready);
  const list = page.getByRole("region", { name: "笔记列表" });
  const row = list.locator(".lesson-card").filter({ hasText: title });
  for (const width of [1200, 1440, 1920, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await row.scrollIntoViewIfNeeded();
    const metrics = await row.evaluate((el) => {
      const link = Array.from(el.querySelectorAll<HTMLElement>(".lesson-main-link")).find((item) => item.offsetHeight > 0)!;
      const heading = link.querySelector("h3")!;
      const text = document.createRange();
      text.selectNodeContents(heading);
      const rowBox = el.getBoundingClientRect();
      const linkBox = link.getBoundingClientRect();
      const textBox = text.getBoundingClientRect();
      return {
        rowHeight: rowBox.height,
        lines: heading.getBoundingClientRect().height / parseFloat(getComputedStyle(heading).lineHeight),
        rowTop: rowBox.top, rowBottom: rowBox.bottom,
        linkTop: linkBox.top, linkBottom: linkBox.bottom,
        textTop: textBox.top, textBottom: textBox.bottom,
        textLeft: textBox.left, textRight: textBox.right,
        linkLeft: linkBox.left, linkRight: linkBox.right,
        nextTop: el.nextElementSibling!.getBoundingClientRect().top,
      };
    });
    if (width >= 1200) {
      expect(metrics.lines).toBeGreaterThanOrEqual(2.9);
      expect(metrics.rowHeight).toBeGreaterThan(70);
      const panes = await Promise.all([list.boundingBox(), page.locator(".notes-preview").boundingBox()]);
      expect(panes[0]!.y).toBeLessThan(280);
      expect(panes[0]!.y + panes[0]!.height).toBeLessThanOrEqual(1000);
      expect(panes[1]!.height).toBeCloseTo(panes[0]!.height, 0);
    }
    expect(metrics.textTop).toBeGreaterThanOrEqual(metrics.rowTop);
    expect(metrics.textBottom).toBeLessThanOrEqual(metrics.rowBottom);
    expect(metrics.textTop).toBeGreaterThanOrEqual(metrics.linkTop);
    expect(metrics.textBottom).toBeLessThanOrEqual(metrics.linkBottom);
    expect(metrics.textLeft).toBeGreaterThanOrEqual(metrics.linkLeft);
    expect(metrics.textRight).toBeLessThanOrEqual(metrics.linkRight);
    expect(metrics.nextTop).toBeGreaterThanOrEqual(metrics.rowBottom);
  }
});

test("guest can skip, go back, select any question, resume, submit and see saved best", async ({ page }) => {
  await page.goto(`/quiz/${quiz.id}`);
  await expect(page.locator(".question-card")).toBeVisible();
  await page.getByRole("button", { name: "先跳过" }).click();
  await expect(page.locator(".question-topline b")).toHaveText("02");
  await page.getByRole("button", { name: "上一题" }).click();
  await expect(page.locator(".question-topline b")).toHaveText("01");
  await page.locator(".quiz-option").nth(quiz.questions[0].answer).click();
  await expect(page.getByText("答对啦，就是这样！")).toBeVisible();
  await expect(page.locator(".quiz-option").first()).toBeDisabled();
  await page.reload();
  await expect(page.getByText("已接上上次的小脚步，之前的选择都在。")).toBeVisible();
  await expect(page.locator(".option-correct")).toHaveCount(1);
  await page.locator(".quiz-map-card .question-dot").last().click();
  await expect(page.locator(".question-topline b")).toHaveText(String(quiz.count).padStart(2, "0"));
  await page.getByRole("button", { name: "完成挑战", exact: true }).click();
  await expect(page.getByText(new RegExp(`还有 ${quiz.count - 1} 道题留白`))).toBeVisible();
  await page.getByRole("button", { name: "确认提交" }).click();
  await expect(page.getByText("成绩已保存在此浏览器", { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tako-jp:guest:v1")!));
  expect(stored.attempts).toHaveLength(1);
  expect(stored.attempts[0].correct).toBe(1);
  expect(stored.attempts[0].answered).toBe(1);
  expect(stored.attempts[0].answers.filter((value: number | null) => value === null)).toHaveLength(quiz.count - 1);
  await page.getByRole("button", { name: "回看题目与解析" }).click();
  await expect(page.getByText(/这道题留下了空白/)).toBeVisible();
  await page.goto("/quiz?level=N5");
  const lesson = page.locator(".lesson-card").filter({ hasText: quiz.title }).first();
  await expect(lesson.locator(".record-best")).toContainText(`${Math.round(100 / quiz.count)}%`);
  await expect(lesson.locator(".record-last")).toContainText("上次");
  await page.goto("/records");
  await expect(page.locator(".record-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".record-row")).toHaveCount(1);
});

test("breadcrumbs return home from each section and JP uses the same upright typeface", async ({ page }) => {
  for (const route of ["/quiz?level=N5", `/quiz/${quiz.id}`, "/notes?level=N5", `/notes/${catalog.notes[0].id}`, "/exams", "/vocabulary", "/records"]) {
    await page.goto(route);
    await page.getByRole("navigation", { name: "面包屑" }).getByRole("link", { name: "返回主页" }).click();
    await expect(page).toHaveURL(`${origin}/`);
  }
  const wordmark = page.locator(".sidebar .tako-wordmark");
  const jp = wordmark.locator(".logo-jp");
  await expect(jp).toHaveText("JP");
  const styles = await jp.evaluate((el) => {
    const jpStyle = getComputedStyle(el);
    const parentStyle = getComputedStyle(el.parentElement!);
    return {
      family: jpStyle.fontFamily, parentFamily: parentStyle.fontFamily, style: jpStyle.fontStyle,
      size: parseFloat(jpStyle.fontSize), parentSize: parseFloat(parentStyle.fontSize),
      color: jpStyle.color, parentColor: parentStyle.color, transform: jpStyle.transform,
    };
  });
  expect(styles.family).toBe(styles.parentFamily);
  expect(styles.style).toBe("normal");
  expect(styles.size).toBeLessThan(styles.parentSize);
  expect(styles.color).not.toBe(styles.parentColor);
  expect(styles.transform).toBe("none");
});

test("notes use an inline desktop reader and mobile-only detail navigation", async ({ page }) => {
  const notes = catalog.notes.filter((note) => note.level === "N5");
  const selected = notes[1];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/notes?level=N5");
  const preview = page.getByRole("region", { name: "笔记内容" });
  const list = page.getByRole("region", { name: "笔记列表" });
  await expect(page.locator(".library-heading")).toHaveCount(1);
  await expect(page.locator(".library-heading")).toBeVisible();
  await expect(page.locator(".library-summary, .library-end, .note-header > p, .reader-tip")).toHaveCount(0);
  await expect(page.locator(".sidebar-postcard")).not.toContainText("一点点");
  await expect(page.locator(".sidebar-postcard .cloud-friend")).toBeVisible();
  await expect(page.locator(".weather, .app-footer")).toHaveCount(0);
  await expect(list.locator(".lesson-label, .lesson-record, .lesson-enter")).toHaveCount(0);
  await expect(preview.getByRole("heading", { level: 1, name: notes[0].title, exact: true })).toBeVisible();
  const boxes = await Promise.all([list.boundingBox(), preview.boundingBox()]);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThan(boxes[1]!.x);
  expect(boxes[0]!.width).toBeLessThanOrEqual(240);
  expect(boxes[0]!.y).toBeLessThan(280);
  expect(boxes[0]!.height).toBeGreaterThanOrEqual(700);
  expect(boxes[0]!.y + boxes[0]!.height).toBeLessThanOrEqual(1000);
  expect(boxes[1]!.x - boxes[0]!.x - boxes[0]!.width).toBeLessThanOrEqual(18);
  expect(await list.locator(".lesson-card").first().evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))).toBeLessThanOrEqual(10);
  expect((await list.locator(".lesson-card").first().boundingBox())!.height).toBeLessThanOrEqual(48);
  await list.getByRole("textbox", { name: "搜索课程" }).fill(selected.title);
  await list.locator(`.lesson-main-link.note-inline-link[href$="note=${selected.id}"]`).click();
  await expect(page).toHaveURL(`${origin}/notes?level=N5&note=${selected.id}`);
  await expect(preview.getByRole("heading", { level: 1, name: selected.title, exact: true })).toBeVisible();
  await expect(list.getByRole("textbox", { name: "搜索课程" })).toHaveValue(selected.title);
  await expect(list.locator(".selected-note .lesson-main-link.note-inline-link")).toHaveAttribute("aria-current", "page");
  await preview.getByRole("button", { name: "读懂了，标记已读" }).click();
  await expect(preview.getByRole("button", { name: "已收入学习足迹" })).toBeDisabled();
  await expect(list.locator(".selected-note .note-inline-link").getByLabel("已读")).toBeVisible();
  await list.getByRole("button", { name: "已读", exact: true }).click();
  await expect(list.locator(".lesson-card")).toHaveCount(1);
  await list.getByRole("button", { name: "未读", exact: true }).click();
  await expect(list.locator(".lesson-card")).toHaveCount(0);
  await list.getByRole("button", { name: /全部/ }).click();
  await expect.poll(() => preview.locator(".reading-meter-panel").evaluate((el) =>
    new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThan(.5);
  await list.getByRole("textbox", { name: "搜索课程" }).fill("");
  await preview.locator(`.note-pagination .note-inline-link[href$="note=${notes[2].id}"]`).click();
  await expect(preview.getByRole("heading", { level: 1, name: notes[2].title, exact: true })).toBeVisible();
  await expect.poll(() => preview.locator(".reader-embedded").evaluate((el) => el.scrollTop)).toBe(0);
  await expect.poll(() => preview.locator(".reading-meter-panel").evaluate((el) =>
    new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(.01);
  await page.goBack();
  await expect(preview.getByRole("heading", { level: 1, name: selected.title, exact: true })).toBeVisible();
  await page.reload();
  await expect(preview.getByRole("button", { name: "已收入学习足迹" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(preview).toBeHidden();
  expect((await list.locator(".lesson-card").first().boundingBox())!.height).toBeLessThanOrEqual(48);
  await list.locator(`.lesson-main-link.note-detail-link[href="/notes/${selected.id}"]`).click();
  await expect(page).toHaveURL(`${origin}/notes/${selected.id}`);
  await expect(page.getByRole("heading", { level: 1, name: selected.title, exact: true })).toBeVisible();
  await expect(list).toBeHidden();
  await page.getByRole("link", { name: "返回笔记森林" }).click();
  await expect(page).toHaveURL(`${origin}/notes?level=N5`);
  await expect(list).toBeVisible();
  await expect(preview).toBeHidden();
  expect((await list.locator(".lesson-card").first().boundingBox())!.y).toBeLessThan(400);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/notes/${selected.id}`);
  await expect(list).toBeVisible();
  await expect(preview.getByRole("heading", { level: 1, name: selected.title, exact: true })).toBeVisible();
  await page.goto("/notes?level=N1");
  await expect(page.getByRole("heading", { name: "N1 的航线，还在绘制中" })).toBeVisible();
  await expect(preview).toHaveCount(0);
  for (const route of [`/notes?level=N4&note=${selected.id}`, "/notes?level=N5&note=missing-note", `/notes?level=N5&note=${selected.id}&note=${notes[2].id}`]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "这座小岛，还没出现在地图上" })).toBeVisible();
    await expect(preview).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("safe Markdown tables and br tags render, and read marks persist", async ({ page }) => {
  const note = loadContent().notes.find((item) => item.title.includes("ば形"))!;
  await page.goto(`/notes/${note.id}`);
  await expect(page.getByRole("heading", { level: 1, name: note.title })).toBeVisible();
  await expect(page.locator(".note-prose table").first()).toBeVisible();
  const image = await page.request.get(noteUrl(note, "0.推量四件套记忆图.png"));
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect([...(await image.body()).subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await expect(page.locator(".note-toc a")).not.toHaveCount(0);
  await page.getByRole("button", { name: "读懂了，标记已读" }).click();
  await expect(page.getByRole("button", { name: "已收入学习足迹" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "已收入学习足迹" })).toBeVisible();
  const brNote = loadContent().notes.find((item) => item.markdown.includes("<br>") && !item.markdown.includes("|"))!;
  await page.goto(`/notes/${brNote.id}`);
  expect(await page.locator(".note-prose br").count()).toBeGreaterThan(0);
  await page.goto("/records");
  await page.getByRole("button", { name: /阅读足迹/ }).click();
  await expect(page.locator(".record-row")).toHaveCount(1);
});

test("register, merge guest records idempotently, logout, login, and isolate accounts", async ({ page, browser }) => {
  const attempt = gradeQuiz(quiz, {
    id: randomUUID(), quizId: quiz.id, version: quiz.version,
    answers: quiz.questions.map((item) => item.answer), durationSeconds: 42, completedAt: new Date().toISOString(),
  });
  await page.addInitScript((value) => localStorage.setItem("tako-jp:guest:v1", JSON.stringify(value)), { attempts: [attempt], reads: [] });
  await page.goto("/");
  await expect(page.locator(".island-card")).toHaveCount(4);
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "还没有护照？免费注册" }).click();
  const username = `tako_${randomUUID().slice(0, 8)}`;
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel(/密码 至少/).fill("a-strong-test-password");
  await page.getByRole("button", { name: "创建账号，开启旅程" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  let response = await page.request.get("/api/progress");
  expect((await response.json()).attempts).toHaveLength(1);
  const cookie = (await page.context().cookies()).find((item) => item.name === "tako-session")!;
  expect(cookie.httpOnly).toBe(true);
  const imported = await page.request.post("/api/progress", { headers: { Origin: origin }, data: { type: "import", attempts: [attempt], reads: [] } });
  expect((await imported.json()).imported).toBe(0);
  const forged = await page.request.post("/api/progress", { headers: { Origin: origin }, data: {
    type: "attempt", attempt: { ...attempt, id: randomUUID(), answers: Array(quiz.count).fill(null), correct: quiz.count, percent: 100 },
  } });
  expect((await forged.json()).attempt.percent).toBe(0);
  await page.reload();
  await expect(page.locator(".account-button")).toContainText(username);
  await page.locator(".account-button").click();
  await page.getByRole("button", { name: "退出账号，切换游客" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect((await page.request.get("/api/progress")).status()).toBe(401);
  await page.locator(".account-button").click();
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel(/密码 至少/).fill("a-strong-test-password");
  await page.getByRole("button", { name: "登录，继续探索", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  response = await page.request.get("/api/progress");
  expect((await response.json()).attempts).toHaveLength(2);
  const other = await browser.newContext();
  const otherRequest = other.request;
  const registered = await otherRequest.post(`${origin}/api/auth/register`, { headers: { Origin: origin }, data: { username: `other_${randomUUID().slice(0, 8)}`, password: "another-test-password" } });
  expect(registered.ok()).toBe(true);
  expect((await (await otherRequest.get(`${origin}/api/progress`)).json()).attempts).toHaveLength(0);
  expect((await otherRequest.post(`${origin}/api/progress`, { headers: { Origin: "https://not-our-site.invalid" }, data: { type: "attempt", attempt } })).status()).toBe(403);
  expect((await otherRequest.post(`${origin}/api/progress`, { headers: { Origin: origin }, data: { type: "attempt", attempt: { ...attempt, version: "stale" } } })).status()).toBe(409);
  await other.close();
});

test("corrupt draft is reported without being silently overwritten", async ({ page }) => {
  const key = `tako-jp:draft:guest:${quiz.id}`;
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, "{broken"), key);
  await page.goto(`/quiz/${quiz.id}`);
  await expect(page.locator(".sync-warning")).toBeVisible();
  await expect(page.locator(".quiz-option").first()).toBeDisabled();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe("{broken");
  await page.locator(".sync-warning").getByRole("button", { name: "重新开始" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "重新开始", exact: true }).click();
  await expect(page.locator(".quiz-option").first()).toBeEnabled();
});

test("responsive layouts fit the viewport, mobile logo and navigation work", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1199, 1200, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/quiz?level=N5", `/quiz/${quiz.id}`, "/notes?level=N5", `/notes/${catalog.notes[1].id}`, "/records"]) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (route === "/notes?level=N5") {
        await expect(page.locator(".notes-preview")).toBeVisible({ visible: width >= 1200 });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: testInfo.outputPath(`notes-${width}.png`), fullPage: true, animations: "disabled" });
      }
    }
    await page.goto("/");
    const logo = page.locator(width <= 760 ? ".mobile-brand .tako-wordmark" : ".sidebar .tako-wordmark");
    const logoSizes = await logo.evaluate((el) => ({
      tako: parseFloat(getComputedStyle(el).fontSize),
      jp: parseFloat(getComputedStyle(el.querySelector(".logo-jp")!).fontSize),
    }));
    expect(logoSizes.jp).toBeLessThan(logoSizes.tako);
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true, animations: "disabled" });
    if (width === 390) {
      await expect(page.locator(".topbar .tako-logo")).toBeVisible();
      await page.getByRole("button", { name: "打开导航" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "学习足迹" }).click();
      await expect(page).toHaveURL(/\/records$/);
    }
  }
});
