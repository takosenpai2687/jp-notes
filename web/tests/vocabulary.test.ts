import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { getVocabulary, getVocabularyDataResponse, getVocabularyDataVersion } from "../src/lib/vocabulary.ts";
import { initialKana, kanaGroup, kanaGroups, kanaRows, kanaVariants, normalizeKana, sampleWords, summarizeVocabularyAttempt, verbClassLabel, vocabularyAttemptInputSchema, vocabularyFingerprints, vocabularyLevels } from "../src/lib/vocabulary-models.ts";
import { resolveSpeechText } from "../src/lib/speech.ts";
import { emptyProgress, mergeProgress, progressSchema } from "../src/lib/models.ts";

test("N5–N1 vocabulary preserves the complete original English datasets and groups by kana", () => {
  for (const [level, count] of [["N5", 674], ["N4", 630], ["N3", 1659], ["N2", 1778], ["N1", 3070]] as const) {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "data", "vocabulary", `${level.toLowerCase()}.json`), "utf8"));
    assert.equal(createHash("sha256").update(JSON.stringify(raw)).digest("hex"), vocabularyFingerprints[level],
      "Upstream fields or ordering changed; update source fingerprint only after intentional data refresh.");
    const words = getVocabulary(level);
    assert.equal(words.length, count);
    assert.equal(sampleWords(words).length, 10);
    assert.equal(resolveSpeechText({ level, wordId: words[0].id, kind: "reading" }), words[0].reading);
    let previous = -1;
    for (const word of words) {
      assert.equal(word.level, level);
      assert.ok(word.word && word.reading && word.romaji && word.meanings.length);
      for (const example of word.examples) {
        assert.ok(example.ja && example.en && example.tatoeba_id);
      }
      const current = kanaGroups.indexOf(kanaGroup(word.reading));
      assert.ok(current >= previous);
      previous = current;
    }
  }
});
test("vocabulary endpoint serves one immutable, content-versioned level per response", async () => {
  const stale = getVocabularyDataResponse(new Request("https://tako-jp.test/api/vocabulary?level=N5&v=stale"));
  assert.equal(stale.status, 404);
  assert.equal(stale.headers.get("cache-control"), "no-store");
  for (const [level, count] of [["N5", 674], ["N4", 630], ["N3", 1659], ["N2", 1778], ["N1", 3070]] as const) {
    const version = getVocabularyDataVersion(level);
    const response = getVocabularyDataResponse(new Request(`https://tako-jp.test/api/vocabulary?level=${level}&v=${version}`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(response.headers.get("netlify-cdn-cache-control"), "public, durable, s-maxage=31536000");
    const body = await response.text();
    assert.ok(gzipSync(body).byteLength < 1_500_000);
    const words = JSON.parse(body) as Array<{ level: string }>;
    assert.equal(words.length, count);
    assert.ok(words.every((word) => word.level === level));
  }
});
test("kana grouping handles katakana, voiced, semi-voiced, small and half-width kana", () => {
  for (const [input, expected] of [["がくせい", "か"], ["パーティー", "は"], ["ｷｬﾝﾌﾟ", "か"], ["ジョギング", "さ"],
    ["ちいさい", "た"], ["ヴァイオリン", "あ"], ["りょこう", "ら"], ["わたし", "わ"], ["ABC", "其他"], ["", "其他"]]) {
    assert.equal(kanaGroup(input), expected);
  }
  assert.equal(normalizeKana("ｱｲｽ"), "あいす");
});
test("random rounds contain exactly ten unique words and do not mutate the source", () => {
  const words = getVocabulary("N5");
  const original = words.map((word) => word.id);
  for (let i = 0; i < 100; i++) {
    const selected = sampleWords(words);
    assert.equal(selected.length, 10);
    assert.equal(new Set(selected.map((word) => word.id)).size, 10);
  }
  assert.deepEqual(words.map((word) => word.id), original);
  assert.throws(() => sampleWords([1, 2], 10));
});
test("kana directory uses precise initial sounds and maps every vocabulary entry to a cell", () => {
  for (const [reading, kana] of [["あう", "あ"], ["いく", "い"], ["がくせい", "が"], ["パーティー", "ぱ"],
    ["ｷｬﾝﾌﾟ", "き"], ["ジョギング", "じ"], ["ヴァイオリン", "ゔ"], ["っ", "つ"], ["ゃ", "や"], ["", ""]]) {
    assert.equal(initialKana(reading), kana);
  }
  const cells = kanaRows.flat().filter(Boolean);
  assert.equal(new Set(cells).size, cells.length);
  assert.equal(kanaVariants.length, 3);
  for (const variant of kanaVariants) {
    assert.equal(variant.rows.length, 11);
    assert.ok(variant.rows.every((row) => row.length === 5));
  }
  assert.deepEqual(kanaVariants[1].rows[5], ["ば", "び", "ぶ", "べ", "ぼ"]);
  assert.deepEqual(kanaVariants[2].rows[5], ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"]);
  assert.equal(kanaVariants[1].rows[0][2], "ゔ");
  assert.ok(kanaVariants[2].rows[1].every((kana) => kana === ""));
  for (const level of vocabularyLevels) {
    for (const word of getVocabulary(level)) {
      assert.ok(cells.some((kana) => kana === initialKana(word.reading)), word.reading);
    }
  }
});
test("verbs use learner-facing classes including special ichidan and suru codes", () => {
  for (const code of ["v5u", "v5r-i", "v5k-s", "v5aru"]) assert.equal(verbClassLabel(code), "1类动词");
  for (const code of ["v1", "v1-s"]) assert.equal(verbClassLabel(code), "2类动词");
  for (const code of ["vk", "vs", "vs-i", "vs-s"]) assert.equal(verbClassLabel(code), "3类动词");
  assert.equal(verbClassLabel("vi"), undefined);
  assert.equal(verbClassLabel("n"), undefined);
});
test("vocabulary attempts are validated, recomputed, backwards compatible and merged idempotently", () => {
  const input = {
    id: randomUUID(), level: "N5", durationSeconds: 30, completedAt: new Date().toISOString(),
    answers: getVocabulary("N5").slice(0, 10).map((word, index) => ({ wordId: word.id, known: index < 4 })),
  };
  const attempt = summarizeVocabularyAttempt(vocabularyAttemptInputSchema.parse({ ...input, known: 10 }));
  assert.equal(attempt.known, 4);
  for (const level of vocabularyLevels) {
    assert.equal(vocabularyAttemptInputSchema.safeParse({ ...input, level }).success, true);
  }
  assert.equal(vocabularyAttemptInputSchema.safeParse({ ...input, level: "N6" }).success, false);
  assert.equal(vocabularyAttemptInputSchema.safeParse({ ...input, answers: input.answers.slice(1) }).success, false);
  assert.equal(vocabularyAttemptInputSchema.safeParse({ ...input, answers: Array(10).fill(input.answers[0]) }).success, false);
  const legacy = progressSchema.parse({ attempts: [], reads: [] });
  assert.deepEqual(legacy.vocabularyAttempts, []);
  const merged = mergeProgress(legacy, { ...emptyProgress(), vocabularyAttempts: [attempt] });
  assert.equal(mergeProgress(merged, merged).vocabularyAttempts.length, 1);
});
