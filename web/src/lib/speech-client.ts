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
const maxAudioBytes = 5 * 1024 * 1024;
let activeStop: (() => void) | undefined;

export function claimSpeech(stop: () => void) {
  activeStop?.();
  activeStop = stop;
  return () => { if (activeStop === stop) activeStop = undefined; };
}

// Provider credentials and text resolution belong behind this same-origin endpoint.
export const requestSpeech: SpeechTransport = async (target, signal) => {
  const body = JSON.stringify(speechRequestSchema.parse(target));
  const cached = audioCache.get(body);
  if (cached) {
    signal.throwIfAborted();
    audioCache.delete(body);
    audioCache.set(body, cached);
    return cached;
  }
  const response = await fetch("/api/speech", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body, signal, cache: "no-store", credentials: "same-origin",
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
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  if (!mime || !["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4"].includes(mime)) {
    throw new Error("发音服务返回的不是可播放音频。");
  }
  const blob = await response.blob();
  signal.throwIfAborted();
  if (!blob.size || blob.size > maxAudioBytes) throw new Error("发音音频为空或过大，请重试。");
  audioCache.set(body, blob);
  while (audioCache.size > 24 || [...audioCache.values()].reduce((sum, item) => sum + item.size, 0) > 12 * 1024 * 1024) {
    audioCache.delete(audioCache.keys().next().value!);
  }
  return blob;
};
