import { createHash, randomUUID } from "node:crypto";
import { getVocabulary } from "./vocabulary.ts";
import type { SpeechRequest } from "./speech-client.ts";

// Youdao Zhiyun TTS (语音合成) — official protocol, confirmed 2026-11:
// https://ai.youdao.com/DOCSIRMA/html/tts/api/yyhc/
//   POST https://openapi.youdao.com/ttsapi (application/x-www-form-urlencoded)
//   signType=v3, sign=sha256(appKey + input + salt + curtime + appSecret)
//   input = q前10字符 + q长度 + q后10字符 (q.length > 20), else q itself
//   success -> binary MP3 (Content-Type: audio/mp3); error -> JSON { errorCode }
// Japanese voices (常见语种): youkejiang (女), yuantianjun (男).
export const youdaoTtsUrl = "https://openapi.youdao.com/ttsapi";
export const defaultJapaneseVoice = "youkejiang";
export const maxSynthesisBytes = 2048;
export const maxAudioBytes = 5 * 1024 * 1024;
export const synthesisTimeoutMs = 12_000;

export class SpeechError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function speechInput(q: string) {
  return q.length > 20 ? `${q.slice(0, 10)}${q.length}${q.slice(-10)}` : q;
}

export function youdaoSign(appKey: string, appSecret: string, q: string, salt: string, curtime: string) {
  return createHash("sha256")
    .update(`${appKey}${speechInput(q)}${salt}${curtime}${appSecret}`, "utf8")
    .digest("hex");
}

export function youdaoCredentials() {
  const appKey = process.env.YOUDAO_APP_KEY?.trim();
  const appSecret = process.env.YOUDAO_APP_SECRET?.trim();
  if (!appKey || !appSecret) throw new SpeechError(503, "发音服务尚未配置，请联系站长接入。");
  return { appKey, appSecret, voice: process.env.YOUDAO_JA_VOICE?.trim() || defaultJapaneseVoice };
}

// Only catalog identifiers are accepted upstream; text is always derived from
// the server-side vocabulary, never from the client.
export function resolveSpeechText(target: SpeechRequest) {
  const word = getVocabulary(target.level).find((item) => item.id === target.wordId);
  if (!word) throw new SpeechError(404, "这个词已不在词库中，暂时无法朗读。");
  if (target.kind === "reading") return word.reading;
  const example = word.examples.find((item) => item.tatoeba_id === target.exampleId);
  if (!example) throw new SpeechError(404, "这句例句已不在词库中，暂时无法朗读。");
  return example.ja;
}

export function youdaoError(errorCode: number | undefined): SpeechError {
  switch (errorCode) {
    case 401: return new SpeechError(503, "发音服务额度已用尽，请联系站长处理。");
    case 411: case 1411: case 2411: return new SpeechError(429, "发音请求过于频繁，请稍后再试。");
    case 108: case 110: case 202: case 206: case 207: return new SpeechError(502, "发音服务配置异常，请联系站长。");
    case 2004: case 2412: return new SpeechError(400, "要朗读的内容过长。");
    default: return new SpeechError(502, "发音服务暂时不可用，请稍后再试。");
  }
}

export async function synthesizeSpeech(options: {
  appKey: string; appSecret: string; voice: string; text: string; signal: AbortSignal;
}): Promise<Buffer> {
  if (Buffer.byteLength(options.text, "utf8") > maxSynthesisBytes) {
    throw new SpeechError(400, "要朗读的内容过长。");
  }
  const salt = randomUUID();
  const curtime = String(Math.floor(Date.now() / 1000));
  const form = new URLSearchParams({
    q: options.text, appKey: options.appKey, salt,
    sign: youdaoSign(options.appKey, options.appSecret, options.text, salt, curtime),
    signType: "v3", curtime, format: "mp3", voiceName: options.voice,
  });
  let response: Response;
  try {
    response = await fetch(youdaoTtsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SpeechError(504, "发音服务响应超时，请稍后再试。");
    }
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new SpeechError(502, "无法连接发音服务，请稍后再试。");
  }
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (type.includes("application/json")) {
    const data = await response.json().catch(() => ({}));
    const code = typeof data?.errorCode === "number" ? data.errorCode
      : typeof data?.errorCode === "string" ? Number(data.errorCode) : undefined;
    throw youdaoError(Number.isFinite(code) ? code : undefined);
  }
  if (!response.ok) throw new SpeechError(502, "发音服务暂时不可用，请稍后再试。");
  if (!type.includes("audio/mpeg") && !type.includes("audio/mp3")) {
    throw new SpeechError(502, "发音服务返回了无法识别的响应，请稍后再试。");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.byteLength || buffer.byteLength > maxAudioBytes) {
    throw new SpeechError(502, "发音服务返回的音频为空或过大，请稍后再试。");
  }
  return buffer;
}
