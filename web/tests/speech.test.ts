import { test } from "node:test";
import assert from "node:assert/strict";
import { claimSpeech, invalidateSpeech, requestSpeech, speechRequestSchema, speechUrl } from "../src/lib/speech-client.ts";

test("speech requests allow only catalog identifiers, not arbitrary text or provider options", () => {
  assert.ok(speechRequestSchema.safeParse({ level: "N5", wordId: "word", kind: "reading" }).success);
  assert.ok(speechRequestSchema.safeParse({ level: "N4", wordId: "word", kind: "example", exampleId: 123 }).success);
  for (const level of ["N3", "N2", "N1"]) {
    assert.ok(speechRequestSchema.safeParse({ level, wordId: "word", kind: "reading" }).success);
  }
  for (const body of [
    { level: "N6", wordId: "word", kind: "reading" },
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
    assert.equal(url, speechUrl(target));
    assert.equal(init.cache, "force-cache");
    assert.equal(init.credentials, "same-origin");
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

test("persistent audio survives memory eviction and invalidation reloads broken clips", async (t) => {
  const saved = new Map<string, Response>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", { configurable: true, value: {
    open: async () => ({
      match: async (key: string) => saved.get(key)?.clone(),
      put: async (key: string, value: Response) => { saved.set(key, value.clone()); },
      delete: async (key: string) => saved.delete(key),
    }),
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "caches", original);
    else Reflect.deleteProperty(globalThis, "caches");
  });
  let requests = 0, mode: RequestCache | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    requests++; mode = init.cache;
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  });
  const signal = new AbortController().signal;
  const target = { level: "N4", wordId: "persistent-clip", kind: "reading" } as const;
  await requestSpeech(target, signal);
  for (let index = 0; index < 49; index++) await requestSpeech({ ...target, wordId: `evict-${index}` }, signal);
  assert.equal(requests, 50);
  await requestSpeech(target, signal);
  assert.equal(requests, 50, "must reuse persistent audio after memory cache eviction");
  await invalidateSpeech(target);
  await requestSpeech(target, signal);
  assert.equal(requests, 51);
  assert.equal(mode, "reload");
});

test("concurrent callers share synthesis and cancelled playback does not waste the result", async (t) => {
  let requests = 0;
  let complete: ((response: Response) => void) | undefined;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return await new Promise<Response>((resolve) => { complete = resolve; });
  });
  const target = { level: "N4", wordId: "concurrent-clip", kind: "reading" } as const;
  const controller = new AbortController();
  const first = requestSpeech(target, controller.signal);
  const second = requestSpeech(target, new AbortController().signal);
  const cancelled = assert.rejects(first, { name: "AbortError" });
  controller.abort();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(requests, 1);
  assert.ok(complete);
  complete(new Response(new Uint8Array([1]), { headers: { "Content-Type": "audio/mpeg" } }));
  await cancelled;
  assert.equal((await second).size, 1);
  assert.equal((await requestSpeech(target, new AbortController().signal)).size, 1);
  assert.equal(requests, 1);
});
