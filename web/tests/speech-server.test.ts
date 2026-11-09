import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { setDefaultResultOrder } from "node:dns";
import path from "node:path";
import { NetlifyDB } from "@netlify/database-dev";
import { getVocabulary } from "../src/lib/vocabulary.ts";
import {
  SpeechError, resolveSpeechText, speechInput, synthesizeSpeech, youdaoError, youdaoSign,
} from "../src/lib/speech.ts";
import { consumeSpeechLimit, database, loadSpeechCache, saveSpeechCache } from "../src/lib/database.ts";

test("Youdao v3 signature follows the documented sha256(appKey+input+salt+curtime+secret) truncation", () => {
  assert.equal(speechInput("こんにちは"), "こんにちは");
  assert.equal(speechInput("あいうえおかきくけこさしすせそたちつてとなにぬねの"),
    "あいうえおかきくけこ25たちつてとなにぬねの");
  assert.equal(youdaoSign("appkey", "secret", "こんにちは", "salt1", "1700000000"),
    "e2a2467977ecac37c40e5f817be808a469a954bff885bec3fa6172e3ead1113a");
  assert.equal(youdaoSign("appkey", "secret", "あいうえおかきくけこさしすせそたちつてとなにぬねの", "salt2", "1700000001"),
    "0d7029e0324c49580bf64c6abb5307b416082cddb281d71cb53e66076b56cfcc");
});

test("speech text resolves kana for readings and raw ja for examples, never romaji or ruby", () => {
  const word = getVocabulary("N5").find((item) => item.word === "会う")!;
  assert.equal(resolveSpeechText({ level: "N5", wordId: word.id, kind: "reading" }), "あう");
  const example = word.examples[0];
  const text = resolveSpeechText({ level: "N5", wordId: word.id, kind: "example", exampleId: example.tatoeba_id });
  assert.equal(text, example.ja);
  assert.ok(!text.includes("{") && !text.includes("|"), "example text must not contain ruby markup");
  assert.throws(() => resolveSpeechText({ level: "N5", wordId: word.id, kind: "example", exampleId: 999999999 }),
    (error) => error instanceof SpeechError && error.status === 404);
  assert.throws(() => resolveSpeechText({ level: "N5", wordId: "missing", kind: "reading" }),
    (error) => error instanceof SpeechError && error.status === 404);
});

test("synthesizeSpeech signs without leaking secrets, validates responses and maps errors", async (t) => {
  const options = { appKey: "appkey", appSecret: "appsecret", voice: "youkejiang", text: "あう", signal: new AbortController().signal };
  let capturedUrl = "";
  let capturedBody = "";
  let behavior: () => Response | Promise<Response> = () =>
    new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mp3" } });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    capturedUrl = String(url);
    capturedBody = String(init.body);
    return await behavior();
  });

  assert.deepEqual([...await synthesizeSpeech(options)], [1, 2, 3]);
  assert.equal(capturedUrl, "https://openapi.youdao.com/ttsapi");
  const body = new URLSearchParams(capturedBody);
  assert.equal(body.get("signType"), "v3");
  assert.equal(body.get("voiceName"), "youkejiang");
  assert.equal(body.get("format"), "mp3");
  assert.equal(body.get("appKey"), "appkey");
  assert.equal(body.get("q"), "あう");
  assert.match(body.get("sign") ?? "", /^[0-9a-f]{64}$/);
  assert.ok(!capturedBody.includes("appsecret"), "request body must not contain the secret");

  const cases: Array<[() => Response, number, RegExp]> = [
    [() => Response.json({ errorCode: 411 }, { headers: { "Content-Type": "application/json" } }), 429, /过于频繁/],
    [() => Response.json({ errorCode: 401 }, { headers: { "Content-Type": "application/json" } }), 503, /额度/],
    [() => Response.json({ errorCode: 202 }, { headers: { "Content-Type": "application/json" } }), 502, /配置异常/],
    [() => new Response("not audio", { headers: { "Content-Type": "text/html" } }), 502, /无法识别/],
    [() => new Response(new Uint8Array(), { headers: { "Content-Type": "audio/mpeg" } }), 502, /为空/],
    [() => new Response(new Uint8Array([1, 2, 3]), { status: 500, headers: { "Content-Type": "audio/mpeg" } }), 502, /暂时不可用/],
  ];
  for (const [respond, status, pattern] of cases) {
    behavior = respond;
    await assert.rejects(synthesizeSpeech(options), (error) =>
      error instanceof SpeechError && error.status === status && pattern.test(error.message));
  }
  behavior = () => { throw new DOMException("timeout", "TimeoutError"); };
  await assert.rejects(synthesizeSpeech(options), (error) => error instanceof SpeechError && error.status === 504);
});

test("provider error codes map to safe Chinese messages", () => {
  assert.equal(youdaoError(411).status, 429);
  assert.equal(youdaoError(401).status, 503);
  assert.equal(youdaoError(202).status, 502);
  assert.equal(youdaoError(2004).status, 400);
  assert.equal(youdaoError(undefined).status, 502);
});

describe("database-backed speech cache and limits", () => {
  const local = new NetlifyDB();
  before(async () => {
    setDefaultResultOrder("ipv4first");
    process.env.NETLIFY_DB_URL = await local.start();
    process.env.NETLIFY_DB_DRIVER = "server";
    await local.applyMigrations(path.join(process.cwd(), "netlify", "database", "migrations"));
  });
  after(async () => {
    await database().pool.end();
    await local.stop();
  });

  test("rate limit and audio cache persist across requests and evict expired entries", async () => {
    for (let i = 0; i < 60; i++) assert.equal(await consumeSpeechLimit("speech:test-ip"), true);
    assert.equal(await consumeSpeechLimit("speech:test-ip"), false);
    await database().pool.query("UPDATE speech_limits SET reset_at = $1 WHERE key = $2", [Date.now() - 1, "speech:test-ip"]);
    assert.equal(await consumeSpeechLimit("speech:test-ip"), true);

    const audio = Buffer.from([1, 2, 3, 4]);
    await saveSpeechCache("speech:key1", audio);
    assert.deepEqual(await loadSpeechCache("speech:key1"), audio);
    assert.equal(await loadSpeechCache("speech:missing"), null);
    await database().pool.query("UPDATE speech_cache SET created_at = $1 WHERE key = $2", [Date.now() - 8 * 24 * 60 * 60 * 1000, "speech:key1"]);
    assert.equal(await loadSpeechCache("speech:key1"), null);
  });
});
