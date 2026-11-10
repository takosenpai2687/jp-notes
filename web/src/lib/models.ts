import { z } from "zod";
import { vocabularyAttemptInputSchema, vocabularyAttemptSchema } from "./vocabulary-models.ts";

export const levels = ["N5", "N4", "N3", "N2", "N1"] as const;
export type Level = (typeof levels)[number];
export const levelLabels: Record<Level, string> = {
  N5: "初めの一歩 · 轻松入门",
  N4: "少しずつ · 稳步前进",
  N3: "もっと遠く · 进阶探索",
  N2: "広い世界 · 自由表达",
  N1: "空の向こう · 向上挑战",
};

export const questionSchema = z.object({
  stem: z.string().min(1),
  source: z.string().min(1),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
  explain: z.string().min(1),
  translation: z.string().min(1),
  tip: z.string().optional(),
});

export const quizSchema = z.object({
  title: z.string().min(1),
  level: z.enum(levels),
  no: z.string(),
  subtitle: z.string().optional(),
  summary: z.array(z.string()).optional().default([]),
  questions: z.array(questionSchema).min(1),
});

export type QuizSource = z.infer<typeof quizSchema>;
export type Question = z.infer<typeof questionSchema>;
export interface QuizSummary {
  id: string;
  title: string;
  level: Level;
  no: string;
  count: number;
  version: string;
  noteId?: string;
}
export interface Quiz extends QuizSummary {
  summary: string[];
  questions: Question[];
}
export interface NoteSummary {
  id: string;
  title: string;
  level: Level;
  no: string;
  filename: string;
  minutes: number;
  excerpt: string;
  quizId?: string;
}
export interface Note extends NoteSummary {
  markdown: string;
}
export interface Catalog {
  quizzes: QuizSummary[];
  notes: NoteSummary[];
}
export interface User {
  id: string;
  username: string;
}

export const attemptInputSchema = z.object({
  id: z.uuid(),
  quizId: z.string().min(1).max(100),
  version: z.string().min(1).max(100),
  answers: z.array(z.number().int().min(0).max(3).nullable()).max(2000),
  durationSeconds: z.number().int().min(0).max(31_536_000),
  completedAt: z.iso.datetime(),
});
export type AttemptInput = z.infer<typeof attemptInputSchema>;
export const attemptSchema = attemptInputSchema.extend({
  title: z.string(),
  level: z.enum(levels),
  total: z.number().int().positive(),
  correct: z.number().int().min(0),
  answered: z.number().int().min(0),
  percent: z.number().int().min(0).max(100),
});
export type Attempt = z.infer<typeof attemptSchema>;
export const readSchema = z.object({
  noteId: z.string().min(1).max(100),
  readAt: z.iso.datetime(),
});
export type NoteRead = z.infer<typeof readSchema>;
export const progressSchema = z.object({
  attempts: z.array(attemptSchema),
  reads: z.array(readSchema),
  vocabularyAttempts: z.array(vocabularyAttemptSchema).default([]),
});
export type Progress = z.infer<typeof progressSchema>;
export const emptyProgress = (): Progress => ({ attempts: [], reads: [], vocabularyAttempts: [] });

export const credentialsSchema = z.object({
  username: z.string().trim().normalize().min(3, "用户名至少 3 个字符")
    .max(24, "用户名最多 24 个字符")
    .regex(/^[\p{L}\p{N}_-]+$/u, "用户名仅支持文字、数字、下划线和短横线"),
  password: z.string().min(8, "密码至少 8 个字符").max(128, "密码最多 128 个字符"),
});
export const progressCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("attempt"), attempt: attemptInputSchema }),
  z.object({ type: z.literal("read"), read: readSchema }),
  z.object({ type: z.literal("vocabulary"), attempt: vocabularyAttemptInputSchema }),
  z.object({
    type: z.literal("import"),
    attempts: z.array(attemptInputSchema).max(200),
    reads: z.array(readSchema).max(200),
    vocabularyAttempts: z.array(vocabularyAttemptInputSchema).max(200).default([]),
  }),
]);

export function isLevel(value: string): value is Level {
  return levels.some((level) => level === value);
}

export function gradeQuiz(quiz: Quiz, input: AttemptInput): Attempt {
  if (input.quizId !== quiz.id || input.version !== quiz.version) {
    throw new Error("测验内容已更新，请刷新页面后重新开始。旧记录仍保留在原处。");
  }
  if (input.answers.length !== quiz.questions.length) {
    throw new Error("答题数量与题目数量不一致。");
  }
  const correct = quiz.questions.filter((q, index) => input.answers[index] === q.answer).length;
  return {
    ...input,
    title: quiz.title,
    level: quiz.level,
    total: quiz.questions.length,
    correct,
    answered: input.answers.filter((answer) => answer !== null).length,
    percent: Math.round(correct / quiz.questions.length * 100),
  };
}

export function mergeProgress(a: Omit<Progress, "vocabularyAttempts"> & Partial<Pick<Progress, "vocabularyAttempts">>,
  b: Omit<Progress, "vocabularyAttempts"> & Partial<Pick<Progress, "vocabularyAttempts">>): Progress {
  const attempts = new Map(a.attempts.map((attempt) => [attempt.id, attempt]));
  for (const attempt of b.attempts) {
    if (!attempts.has(attempt.id)) attempts.set(attempt.id, attempt);
  }
  const reads = new Map(a.reads.map((read) => [read.noteId, read]));
  for (const read of b.reads) {
    const previous = reads.get(read.noteId);
    if (!previous || read.readAt > previous.readAt) reads.set(read.noteId, read);
  }
  const vocabulary = new Map((a.vocabularyAttempts ?? []).map((attempt) => [attempt.id, attempt]));
  for (const attempt of b.vocabularyAttempts ?? []) {
    if (!vocabulary.has(attempt.id)) vocabulary.set(attempt.id, attempt);
  }
  return {
    attempts: [...attempts.values()].sort((x, y) => y.completedAt.localeCompare(x.completedAt)),
    reads: [...reads.values()].sort((x, y) => y.readAt.localeCompare(x.readAt)),
    vocabularyAttempts: [...vocabulary.values()].sort((x, y) => y.completedAt.localeCompare(x.completedAt)),
  };
}

export function quizStats(attempts: Attempt[], quizId: string) {
  const matches = attempts.filter((attempt) => attempt.quizId === quizId);
  return {
    count: matches.length,
    latest: matches.reduce<Attempt | undefined>((best, item) =>
      !best || item.completedAt > best.completedAt ? item : best, undefined),
    best: matches.reduce<Attempt | undefined>((best, item) =>
      !best || item.percent > best.percent ? item : best, undefined),
  };
}

export function formatDate(value: string, withTime = true) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(new Date(value));
}

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
