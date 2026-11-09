import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { speechRequestSchema } from "@/lib/speech-client";
import { consumeSpeechLimit, loadSpeechCache, saveSpeechCache } from "@/lib/database";
import {
  SpeechError, resolveSpeechText, synthesizeSpeech, synthesisTimeoutMs, youdaoCredentials,
} from "@/lib/speech";
import { apiError, readJson, requireUser } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withTimeout(signal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
  return { signal: controller.signal, cleanup: () => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); } };
}

export async function POST(request: Request) {
  try {
    const target = speechRequestSchema.parse(await readJson(request));
    const user = await requireUser();
    const text = resolveSpeechText(target);
    const credentials = youdaoCredentials();
    const cacheKey = createHash("sha256").update(JSON.stringify({
      kind: target.kind, level: target.level, wordId: target.wordId,
      exampleId: target.kind === "example" ? target.exampleId : null,
      text, voice: credentials.voice,
    })).digest("hex");
    let audio = await loadSpeechCache(cacheKey);
    if (!audio) {
      if (!await consumeSpeechLimit(`speech:user:${user.id}`)) {
        throw new SpeechError(429, "发音请求过于频繁，请稍后再试。");
      }
      const { signal, cleanup } = withTimeout(request.signal, synthesisTimeoutMs);
      try {
        audio = await synthesizeSpeech({ ...credentials, text, signal });
        signal.throwIfAborted();
      } catch (error) {
        if (signal.aborted && signal.reason instanceof DOMException && signal.reason.name === "TimeoutError") {
          throw new SpeechError(504, "发音服务响应超时，请稍后再试。");
        }
        throw error;
      } finally {
        cleanup();
      }
      await saveSpeechCache(cacheKey, audio);
    }
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    if (error instanceof SpeechError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiError(error);
  }
}
