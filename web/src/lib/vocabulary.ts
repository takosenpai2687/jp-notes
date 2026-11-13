import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { isLevel } from "./models.ts";
import { vocabularySchema } from "./vocabulary-models.ts";
import { kanaGroup, kanaGroups } from "./vocabulary-models.ts";
import { vocabularyFingerprints, vocabularyLevels } from "./vocabulary-models.ts";
import type { VocabularyLevel, VocabularyWord } from "./vocabulary-models.ts";

const cache = new Map<VocabularyLevel, VocabularyWord[]>();
const vocabularyPayloads = new Map<VocabularyLevel, string>();

export function getVocabularyDataVersion(level: VocabularyLevel) {
  return vocabularyFingerprints[level];
}

export function getVocabularyPayload(level: VocabularyLevel) {
  const cached = vocabularyPayloads.get(level);
  if (cached) return cached;
  const directory = process.env.NODE_ENV === "production" ? ".netlify-content" : "data";
  const json = readFileSync(path.join(process.cwd(), directory, "vocabulary", `${level.toLowerCase()}.json`), "utf8");
  const fingerprint = createHash("sha256").update(JSON.stringify(JSON.parse(json))).digest("hex");
  if (fingerprint !== vocabularyFingerprints[level]) throw new Error(`词库 ${level} 与缓存版本不匹配。`);
  vocabularyPayloads.set(level, json);
  return json;
}

export function getVocabularyDataResponse(request: Request) {
  const query = new URL(request.url).searchParams;
  const level = query.get("level");
  if ([...query].length !== 2 || !level || !isLevel(level) || query.get("v") !== getVocabularyDataVersion(level)) {
    return new Response(JSON.stringify({ error: "词库等级或版本不正确，请刷新页面。" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(getVocabularyPayload(level), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

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
