import { z } from "zod";

export const vocabularyLevels = ["N5", "N4", "N3", "N2", "N1"] as const;
export type VocabularyLevel = (typeof vocabularyLevels)[number];
// Keep these in sync with the upstream JSON; they also version the immutable browser/CDN cache.
export const vocabularyFingerprints: Record<VocabularyLevel, string> = {
  N5: "7ac633cdd24c437736794826771cb550d881f034bdb9c6c21df196b52373a078",
  N4: "1c9ca416712896080f2c3dcf27a6739b1cadb6f6820f59dad2b28c3970a81be6",
  N3: "aa1a6bf8c4921d1f46b063026336b4e5e8515d58b6e914353323e7b520f2da6c",
  N2: "8f0ee6d4cac70ae8febbea8630db289ff9af2a0df4666ac34839ac2807dbd463",
  N1: "824c4f22b813616fe68d7753a9abf3c8e31a11be154d96ebd49b41c9fdd558e8",
};
export const vocabularySchema = z.object({
  id: z.string().min(1),
  word: z.string().min(1),
  reading: z.string().min(1),
  romaji: z.string(),
  meanings: z.array(z.string().min(1)).min(1),
  level: z.enum(vocabularyLevels),
  pos: z.array(z.string()).default([]),
  jmdict_id: z.number().nullable().optional(),
  other_forms: z.array(z.string()).optional(),
  other_readings: z.array(z.string()).optional(),
  examples: z.array(z.object({
    ja: z.string(), en: z.string(),
    furigana: z.string().optional(), tatoeba_id: z.number(),
  })).default([]),
});
export type VocabularyWord = z.infer<typeof vocabularySchema>;
export type VocabularySummary = Pick<VocabularyWord, "id" | "word" | "reading" | "romaji" | "meanings">;
export const kanaGroups = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "其他"] as const;
const basicKanaRows = [
  ["あ", "い", "う", "え", "お"], ["か", "き", "く", "け", "こ"],
  ["さ", "し", "す", "せ", "そ"], ["た", "ち", "つ", "て", "と"],
  ["な", "に", "ぬ", "ね", "の"], ["は", "ひ", "ふ", "へ", "ほ"],
  ["ま", "み", "む", "め", "も"], ["や", "", "ゆ", "", "よ"],
  ["ら", "り", "る", "れ", "ろ"], ["わ", "", "", "", "を"],
  ["ん", "", "", "", ""],
] as const;
export const kanaVariants = [
  { id: "plain", label: "清音", rows: basicKanaRows },
  { id: "voiced", label: "浊音", rows: basicKanaRows.map((row) => row.map((kana) =>
    kana && "うかきくけこさしすせそたちつてとはひふへほ".includes(kana) ? `${kana}\u3099`.normalize("NFC") : "")) },
  { id: "semi-voiced", label: "半浊音", rows: basicKanaRows.map((row) => row.map((kana) =>
    kana && "はひふへほ".includes(kana) ? `${kana}\u309a`.normalize("NFC") : "")) },
] as const;
export const kanaRows = kanaVariants.flatMap<readonly string[]>((variant) => variant.rows);
export function initialKana(reading: string) {
  const first = normalizeKana(reading)[0] ?? "";
  const small = "ぁぃぅぇぉっゃゅょゎ";
  const index = small.indexOf(first);
  return first && index >= 0 ? "あいうえおつやゆよわ"[index] : first;
}
export function verbClassLabel(pos: string) {
  if (pos.startsWith("v5")) return "1类动词";
  if (pos === "v1" || pos === "v1-s") return "2类动词";
  if (pos === "vk" || pos === "vs" || pos.startsWith("vs-")) return "3类动词";
  return undefined;
}
export function normalizeKana(value: string) {
  return value.normalize("NFKC").replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60));
}
export function kanaGroup(reading: string): (typeof kanaGroups)[number] {
  const first = normalizeKana(reading).normalize("NFD")[0];
  if (!first) return "其他";
  const rows = ["あいうえおぁぃぅぇぉ", "かきくけこ", "さしすせそ", "たちつてとっ", "なにぬねの",
    "はひふへほ", "まみむめも", "やゆよゃゅょ", "らりるれろ", "わをんゎ"];
  const index = rows.findIndex((row) => row.includes(first));
  return index < 0 ? "其他" : kanaGroups[index];
}
export const vocabularyAttemptInputSchema = z.object({
  id: z.uuid(), level: z.enum(vocabularyLevels),
  answers: z.array(z.object({ wordId: z.string().min(1).max(100), known: z.boolean() })).length(10)
    .refine((answers) => new Set(answers.map((answer) => answer.wordId)).size === answers.length, "一轮不能重复记录同一个词"),
  durationSeconds: z.number().int().min(0).max(31_536_000),
  completedAt: z.iso.datetime(),
});
export type VocabularyAttemptInput = z.infer<typeof vocabularyAttemptInputSchema>;
export const vocabularyAttemptSchema = vocabularyAttemptInputSchema.extend({
  total: z.literal(10), known: z.number().int().min(0).max(10),
});
export type VocabularyAttempt = z.infer<typeof vocabularyAttemptSchema>;
export function summarizeVocabularyAttempt(input: VocabularyAttemptInput): VocabularyAttempt {
  return { ...input, total: 10, known: input.answers.filter((answer) => answer.known).length };
}
export function sampleWords<T>(words: readonly T[], count = 10, random = Math.random): T[] {
  if (count < 1 || count > words.length) throw new Error("可抽背词数不足。");
  const pool = [...words];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
