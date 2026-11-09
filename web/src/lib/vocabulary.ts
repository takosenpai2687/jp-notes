import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { vocabularySchema } from "./vocabulary-models.ts";
import { kanaGroup, kanaGroups } from "./vocabulary-models.ts";
import type { VocabularyLevel, VocabularyWord } from "./vocabulary-models.ts";

const cache = new Map<VocabularyLevel, VocabularyWord[]>();
export function getVocabulary(level: VocabularyLevel) {
  const cached = cache.get(level);
  if (cached) return cached;
  const directory = process.env.NODE_ENV === "production" ? ".netlify-content" : "data";
  const words = z.array(vocabularySchema).parse(JSON.parse(readFileSync(
    path.join(process.cwd(), directory, "vocabulary", `${level.toLowerCase()}.json`), "utf8",
  )));
  if (words.some((word) => word.level !== level) || new Set(words.map((word) => word.id)).size !== words.length) {
    throw new Error(`词库 ${level} 等级或 ID 异常。`);
  }
  words.sort((a, b) => kanaGroups.indexOf(kanaGroup(a.reading)) - kanaGroups.indexOf(kanaGroup(b.reading))
    || a.reading.localeCompare(b.reading, "ja") || a.id.localeCompare(b.id));
  cache.set(level, words);
  return words;
}
