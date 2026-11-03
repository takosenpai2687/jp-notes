import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import { getCatalog, getNote, getQuiz, loadContent, noteOutline, noteUrl, notesRoot } from "../src/lib/content.ts";
import { attemptInputSchema, credentialsSchema, emptyProgress, gradeQuiz, levels, mergeProgress, quizStats } from "../src/lib/models.ts";
import { parseDraft } from "../src/lib/draft.ts";
import type { AttemptInput } from "../src/lib/models.ts";

const catalog = getCatalog();
const quiz = getQuiz(catalog.quizzes[0].id)!;
function input(override: Partial<AttemptInput> = {}): AttemptInput {
  return {
    id: randomUUID(), quizId: quiz.id, version: quiz.version,
    answers: quiz.questions.map((question) => question.answer),
    completedAt: new Date().toISOString(), durationSeconds: 30, ...override,
  };
}

test("catalog loads every source JSON and Markdown, never standalone HTML", () => {
  let quizzes = 0, notes = 0;
  for (const level of levels) {
    for (const [directory, extension] of [["quiz", ".json"], [path.join("notes", "raw"), ".md"]]) {
      try {
        const count = readdirSync(path.join(process.cwd(), "..", directory, level.toLowerCase()))
          .filter((name) => name.endsWith(extension)).length;
        if (extension === ".json") quizzes += count; else notes += count;
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
  }
  assert.equal(catalog.quizzes.length, quizzes);
  assert.equal(catalog.notes.length, notes);
  assert.equal(new Set(catalog.notes.map((note) => note.id)).size, notes);
  assert.equal(new Set(catalog.quizzes.map((item) => item.id)).size, quizzes);
  assert.ok(quizzes > 0 && notes > 0);
  const allContent = loadContent();
  for (const source of allContent.quizzes) {
    assert.equal(source.questions.length, source.count);
    assert.ok(source.questions.every((question) => question.options.length === 4));
    if (source.noteId) assert.equal(allContent.notes.find((note) => note.id === source.noteId)?.quizId, source.id);
  }
  assert.equal(getNote(catalog.notes[0].id)?.title, catalog.notes[0].title);
});
test("grading counts blank questions as unanswered and incorrect", () => {
  const perfect = gradeQuiz(quiz, input());
  assert.equal(perfect.percent, 100);
  const blank = gradeQuiz(quiz, input({ answers: Array(quiz.count).fill(null) }));
  assert.equal(blank.correct, 0); assert.equal(blank.answered, 0); assert.equal(blank.percent, 0);
  const answers = quiz.questions.map((): number | null => null);
  answers[0] = quiz.questions[0].answer;
  const partial = gradeQuiz(quiz, input({ answers }));
  assert.equal(partial.correct, 1);
  assert.equal(partial.percent, Math.round(100 / quiz.count));
});
test("grading rejects stale content, wrong quiz ids and mismatched answer counts", () => {
  assert.throws(() => gradeQuiz(quiz, input({ version: "old-version" })));
  assert.throws(() => gradeQuiz(quiz, input({ quizId: "../other.json" })));
  assert.throws(() => gradeQuiz(quiz, input({ answers: [] })));
  assert.equal(attemptInputSchema.safeParse(input({ answers: [4] })).success, false);
});
test("guest merges are idempotent and preserve best versus latest independently", () => {
  const best = gradeQuiz(quiz, input({ completedAt: "2026-01-01T10:00:00.000Z" }));
  const latest = gradeQuiz(quiz, input({ answers: Array(quiz.count).fill(null), completedAt: "2026-01-02T10:00:00.000Z" }));
  const progress = { attempts: [best, latest], reads: [{ noteId: "note", readAt: "2026-01-01T10:00:00.000Z" }] };
  const merged = mergeProgress(mergeProgress(emptyProgress(), progress), {
    ...progress, reads: [{ noteId: "note", readAt: "2026-01-02T10:00:00.000Z" }],
  });
  assert.equal(merged.attempts.length, 2);
  assert.equal(merged.reads.length, 1);
  assert.equal(merged.reads[0].readAt, "2026-01-02T10:00:00.000Z");
  assert.equal(quizStats(merged.attempts, quiz.id).best?.id, best.id);
  assert.equal(quizStats(merged.attempts, quiz.id).latest?.id, latest.id);
});
test("drafts preserve blanks and reject stale versions, invalid cursors and corrupt data", () => {
  const draft = { id: randomUUID(), version: quiz.version, answers: Array(quiz.count).fill(null), index: 1, startedAt: Date.now() };
  assert.equal(parseDraft(JSON.stringify(draft), quiz).answers[0], null);
  assert.throws(() => parseDraft("{broken", quiz));
  assert.throws(() => parseDraft(JSON.stringify({ ...draft, index: quiz.count }), quiz));
  assert.throws(() => parseDraft(JSON.stringify({ ...draft, version: "old" }), quiz));
  assert.throws(() => parseDraft(JSON.stringify({ ...draft, answers: [] }), quiz));
});
test("note headings, tables, br tags and safe local assets remain available", () => {
  const note = loadContent().notes.find((item) => item.title.includes("ば形"))!;
  assert.ok(note.markdown.includes("| 原形"));
  assert.ok(loadContent().notes.some((item) => item.markdown.includes("<br>")));
  const outline = noteOutline("# Title\n## 相同\n## 相同\n```\n## not a heading\n```\n### 子标题");
  assert.deepEqual(outline.map((heading) => heading.id), ["相同", "相同-1", "子标题"]);
  assert.equal(noteUrl(note, "javascript:alert(1)"), "");
  assert.equal(noteUrl(note, "../../../../private.png"), "");
  assert.equal(noteUrl(note, "%zz"), "");
  assert.equal(noteUrl(note, "https://example.com"), "https://example.com");
  assert.ok(noteUrl(note, "0.推量四件套记忆图.png").startsWith("/api/note-assets/"));
  assert.ok(notesRoot.endsWith(path.join("notes", "raw")));
});
test("credential schema validates usernames and password constraints", () => {
  assert.ok(credentialsSchema.safeParse({ username: "たこ_同学", password: "my-password-123" }).success);
  assert.equal(credentialsSchema.safeParse({ username: "../bad", password: "my-password-123" }).success, false);
  assert.equal(credentialsSchema.safeParse({ username: "tako", password: "short" }).success, false);
});
test("grade shape never trusts client-supplied scores", () => {
  const forged = { ...input({ answers: Array(quiz.count).fill(null) }), percent: 100, correct: quiz.count };
  const checked = gradeQuiz(quiz, attemptInputSchema.parse(forged));
  assert.equal(checked.percent, 0); assert.equal(checked.correct, 0);
  assert.equal(quiz.level, catalog.quizzes[0].level);
});
