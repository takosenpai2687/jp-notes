import { z } from "zod";
import { vocabularyLevels } from "./vocabulary-models.ts";

const target = { level: z.enum(vocabularyLevels), wordId: z.string().min(1).max(100) };
export const speechRequestSchema = z.discriminatedUnion("kind", [
  z.object({ ...target, kind: z.literal("reading") }).strict(),
  z.object({ ...target, kind: z.literal("example"), exampleId: z.number().int().positive() }).strict(),
]);
export type SpeechRequest = z.infer<typeof speechRequestSchema>;
export type SpeechState = "idle" | "loading" | "playing" | "error";
export type SpeechTransport = (target: SpeechRequest, signal: AbortSignal) => Promise<Blob>;

const audioCache = new Map<string, Blob>();
const inFlight = new Map<string, Promise<Blob>>();
const reload = new Set<string>();
const maxAudioBytes = 5 * 1024 * 1024;
export const speechCacheVersion = process.env.NEXT_PUBLIC_SPEECH_CACHE_VERSION?.trim() || "1";
const cacheName = `tako-jp:speech:${speechCacheVersion}`;
let activeStop: (() => void) | undefined;
let warnedStorage = false;
let requestedPersistence = false;

function storageWarning(error: unknown) {
  if (warnedStorage) return;
  warnedStorage = true;
  console.warn("[tako-jp] Speech persistence unavailable; playback still works, but future visits may need synthesis.", error);
}

export function speechUrl(input: SpeechRequest) {
  const parsed = speechRequestSchema.parse(input);
  const query = new URLSearchParams({ v: speechCacheVersion, level: parsed.level, wordId: parsed.wordId, kind: parsed.kind });
  if (parsed.kind === "example") query.set("exampleId", String(parsed.exampleId));
  return `/api/speech?${query}`;
}

function remember(key: string, blob: Blob) {
  audioCache.delete(key);
  audioCache.set(key, blob);
  while (audioCache.size > 48 || [...audioCache.values()].reduce((sum, item) => sum + item.size, 0) > 24 * 1024 * 1024) {
    audioCache.delete(audioCache.keys().next().value!);
  }
}

async function persistentCache() {
  if (typeof caches === "undefined") return undefined;
  try { return await caches.open(cacheName); }
  catch (error) { storageWarning(error); return undefined; }
}

function retainStorage() {
  if (requestedPersistence || typeof navigator === "undefined" || !navigator.storage?.persist) return;
  requestedPersistence = true;
  void navigator.storage.persist().then((granted) => {
    if (!granted) console.info("[tako-jp] Browser may evict speech storage when device space is low.");
  }).catch(storageWarning);
}

async function audioBlob(response: Response) {
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  if (!mime || !["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4"].includes(mime)) {
    throw new Error("发音服务返回的不是可播放音频。");
  }
  const blob = await response.blob();
  if (!blob.size || blob.size > maxAudioBytes) throw new Error("发音音频为空或过大，请重试。");
  return blob;
}

export async function invalidateSpeech(target: SpeechRequest) {
  const key = speechUrl(target);
  audioCache.delete(key);
  reload.add(key);
  const cache = await persistentCache();
  try { await cache?.delete(key); }
  catch (error) { storageWarning(error); }
}

export function claimSpeech(stop: () => void) {
  activeStop?.();
  activeStop = stop;
  return () => { if (activeStop === stop) activeStop = undefined; };
}

async function loadAudio(key: string): Promise<Blob> {
  const cache = await persistentCache();
  if (cache && !reload.has(key)) {
    let response: Response | undefined;
    try { response = await cache.match(key); }
    catch (error) { storageWarning(error); }
    if (response?.ok) {
      try {
        const blob = await audioBlob(response);
        remember(key, blob);
        return blob;
      } catch (error) {
        console.warn("[tako-jp] Invalid cached speech discarded.", error);
        await invalidateSpeechFromCache(cache, key);
        reload.add(key);
      }
    }
  }
  const response = await fetch(key, {
    signal: AbortSignal.timeout(20_000), cache: reload.has(key) ? "reload" : "force-cache", credentials: "same-origin",
  });
  if (!response.ok) {
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const data: unknown = await response.json();
      const parsed = z.object({ error: z.string().min(1).max(300) }).safeParse(data);
      if (parsed.success) throw new Error(parsed.data.error);
    }
    if (response.status === 404 || response.status === 501) throw new Error("发音服务尚未接入，请稍后再试。");
    throw new Error("发音请求失败，请稍后重试。");
  }
  const blob = await audioBlob(response);
  remember(key, blob);
  reload.delete(key);
  if (cache) {
    try {
      await cache.put(key, new Response(blob, { headers: {
        "Content-Type": blob.type, "Cache-Control": "private, max-age=31536000, immutable",
      } }));
      retainStorage();
    } catch (error) { storageWarning(error); }
  }
  return blob;
}

async function invalidateSpeechFromCache(cache: Cache, key: string) {
  try { await cache.delete(key); }
  catch (error) { storageWarning(error); }
}

// Keep a paid synthesis running when playback is cancelled, so its result is not wasted.
export const requestSpeech: SpeechTransport = async (target, signal) => {
  signal.throwIfAborted();
  const key = speechUrl(target);
  const cached = audioCache.get(key);
  if (cached) { remember(key, cached); return cached; }
  let pending = inFlight.get(key);
  if (!pending) {
    const load = async () => {
      if (typeof navigator !== "undefined" && navigator.locks) {
        return await navigator.locks.request(`tako-speech:${key}`, () => loadAudio(key));
      }
      return await loadAudio(key);
    };
    pending = load().finally(() => { inFlight.delete(key); });
    inFlight.set(key, pending);
  }
  return await new Promise<Blob>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    pending.then((blob) => { if (!signal.aborted) resolve(blob); }, reject)
      .finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
};
