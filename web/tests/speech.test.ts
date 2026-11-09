import { test } from "node:test";
import assert from "node:assert/strict";
import { claimSpeech, requestSpeech, speechRequestSchema } from "../src/lib/speech-client.ts";

test("speech requests allow only catalog identifiers, not arbitrary text or provider options", () => {
  assert.ok(speechRequestSchema.safeParse({ level: "N5", wordId: "word", kind: "reading" }).success);
  assert.ok(speechRequestSchema.safeParse({ level: "N4", wordId: "word", kind: "example", exampleId: 123 }).success);
  for (const body of [
    { level: "N3", wordId: "word", kind: "reading" },
    { level: "N5", wordId: "word", kind: "reading", text: "arbitrary text" },
    { level: "N5", wordId: "word", kind: "example", exampleId: -1 },
  ]) assert.equal(speechRequestSchema.safeParse(body).success, false);
});
test("speech transport validates responses, caches only audio and supports cancellation", async (t) => {
  const target = { level: "N5", wordId: "unit-audio", kind: "reading" } as const;
  const signal = new AbortController().signal;
  let response = new Response("not connected", { status: 404 });
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests++;
    assert.equal(url, "/api/speech");
    assert.equal(init.method, "POST");
    assert.equal(init.body, JSON.stringify(target));
    return response.clone();
  });
  await assert.rejects(requestSpeech(target, signal), /尚未接入/);
  response = Response.json({ error: "这个词已不在词库中" }, { status: 404 });
  await assert.rejects(requestSpeech(target, signal), /不在词库/);
  response = Response.json({ error: "额度不足" }, { status: 429 });
  await assert.rejects(requestSpeech(target, signal), /额度不足/);
  response = Response.json({ audio: "not binary" });
  await assert.rejects(requestSpeech(target, signal), /不是可播放音频/);
  response = new Response(new Uint8Array(), { headers: { "Content-Type": "audio/mpeg" } });
  await assert.rejects(requestSpeech(target, signal), /为空/);
  response = new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  assert.equal((await requestSpeech(target, signal)).size, 3);
  assert.equal((await requestSpeech(target, signal)).size, 3);
  assert.equal(requests, 6);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestSpeech(target, controller.signal), { name: "AbortError" });
});
test("claiming playback stops the previous speaker and stale releases do not cancel the new one", () => {
  let stoppedA = 0, stoppedB = 0;
  const releaseA = claimSpeech(() => { stoppedA++; });
  const releaseB = claimSpeech(() => { stoppedB++; });
  assert.equal(stoppedA, 1);
  releaseA();
  const releaseC = claimSpeech(() => {});
  assert.equal(stoppedB, 1);
  releaseB(); releaseC();
});
