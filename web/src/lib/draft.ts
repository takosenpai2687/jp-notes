import { z } from "zod";
import type { Quiz } from "./models.ts";

const draftSchema = z.object({
  id: z.uuid(),
  version: z.string(),
  answers: z.array(z.number().int().min(0).max(3).nullable()),
  index: z.number().int().min(0),
  startedAt: z.number().finite().positive(),
});
export type Draft = z.infer<typeof draftSchema>;
export function parseDraft(raw: string, quiz: Quiz): Draft {
  const draft = draftSchema.parse(JSON.parse(raw));
  if (draft.version !== quiz.version) throw new Error("测验内容已更新，旧草稿不再适用。请点击「重新开始」。");
  if (draft.answers.length !== quiz.count || draft.index >= quiz.count) throw new Error("草稿与题目数量不一致，请重新开始。");
  if (draft.startedAt > Date.now() + 300_000) throw new Error("草稿时间异常，请检查设备时钟并重新开始。");
  return draft;
}
