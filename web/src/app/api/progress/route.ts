import { NextResponse } from "next/server";
import { loadContent } from "@/lib/content";
import { loadProgress, saveAttempt, saveRead, saveVocabularyAttempt, transaction } from "@/lib/database";
import { getVocabulary } from "@/lib/vocabulary";
import { summarizeVocabularyAttempt } from "@/lib/vocabulary-models";
import type { VocabularyAttemptInput } from "@/lib/vocabulary-models";
import { gradeQuiz, progressCommandSchema } from "@/lib/models";
import type { AttemptInput, NoteRead, Quiz } from "@/lib/models";
import { apiError, HttpError, readJson, requireUser } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function checkedAttempt(input: AttemptInput, quiz: Quiz | undefined) {
  if (!quiz) throw new HttpError(404, "这份测验已不在题库中，记录仍保留在本机。");
  if (Date.parse(input.completedAt) > Date.now() + 300_000) throw new HttpError(400, "记录时间不正确，请检查设备时钟。");
  try { return gradeQuiz(quiz, input); }
  catch (error) { throw new HttpError(409, error instanceof Error ? error.message : "测验版本不一致。"); }
}
function checkedRead(read: NoteRead, exists: boolean) {
  if (!exists) throw new HttpError(404, "这篇笔记已不在目录中。");
  if (Date.parse(read.readAt) > Date.now() + 300_000) throw new HttpError(400, "阅读时间不正确。");
  return read;
}
function checkedVocabularyAttempt(input: VocabularyAttemptInput) {
  if (Date.parse(input.completedAt) > Date.now() + 300_000) throw new HttpError(400, "抽背时间不正确。");
  const ids = new Set(getVocabulary(input.level).map((word) => word.id));
  if (input.answers.some((answer) => !ids.has(answer.wordId))) throw new HttpError(400, "抽背记录包含不属于该等级的单词。");
  return summarizeVocabularyAttempt(input);
}
export async function GET() {
  try { return NextResponse.json(await loadProgress((await requireUser()).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const command = progressCommandSchema.parse(await readJson(request));
    const user = await requireUser();
    if (command.type === "vocabulary") {
      return NextResponse.json({ attempt: await saveVocabularyAttempt(user.id, checkedVocabularyAttempt(command.attempt)) });
    }
    const content = loadContent();
    const quizzes = new Map(content.quizzes.map((quiz) => [quiz.id, quiz]));
    const notes = new Set(content.notes.map((note) => note.id));
    if (command.type === "attempt") {
      const attempt = checkedAttempt(command.attempt, quizzes.get(command.attempt.quizId));
      const saved = await saveAttempt(user.id, attempt);
      return NextResponse.json({ attempt: saved });
    }
    if (command.type === "read") {
      const read = checkedRead(command.read, notes.has(command.read.noteId));
      return NextResponse.json({ read: await saveRead(user.id, read) });
    }
    const rejected: string[] = [];
    let imported = 0;
    await transaction(async (client) => {
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      const progress = await loadProgress(user.id, client);
      const existing = new Set(progress.attempts.map((attempt) => attempt.id));
      for (const input of command.attempts) {
        if (existing.has(input.id)) continue;
        try {
          await saveAttempt(user.id, checkedAttempt(input, quizzes.get(input.quizId)), client);
          existing.add(input.id);
          imported++;
        } catch (error) {
          if (!(error instanceof HttpError)) throw error;
          rejected.push(`${input.quizId}：${error.message}`);
        }
      }
      for (const read of command.reads) {
        try { await saveRead(user.id, checkedRead(read, notes.has(read.noteId)), client); }
        catch (error) {
          if (!(error instanceof HttpError)) throw error;
          rejected.push(`${read.noteId}：${error.message}`);
        }
      }
      const vocabularyIds = new Set(progress.vocabularyAttempts.map((attempt) => attempt.id));
      for (const input of command.vocabularyAttempts) {
        if (vocabularyIds.has(input.id)) continue;
        try {
          await saveVocabularyAttempt(user.id, checkedVocabularyAttempt(input), client);
          vocabularyIds.add(input.id);
          imported++;
        } catch (error) {
          if (!(error instanceof HttpError)) throw error;
          rejected.push(`单词抽背：${error.message}`);
        }
      }
    });
    return NextResponse.json({ imported, rejected });
  } catch (error) { return apiError(error); }
}
