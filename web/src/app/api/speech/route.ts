import { NextResponse } from "next/server";
import { speechCacheVersion, speechRequestSchema } from "@/lib/speech-client";
import { consumeSpeechLimit } from "@/lib/database";
import {
  SpeechError, resolveSpeechText, synthesizeSpeech, synthesisTimeoutMs, youdaoCredentials,
} from "@/lib/speech";
import { apiError, HttpError, readJson, requireUser } from "@/lib/server";

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

async function handle(request: Request, body: unknown) {
  try {
    const user = await requireUser();
    const target = speechRequestSchema.parse(body);
    const text = resolveSpeechText(target);
    const credentials = youdaoCredentials();
    if (!await consumeSpeechLimit(`speech:user:${user.id}`)) {
      throw new SpeechError(429, "发音请求过于频繁，请稍后再试。");
    }
    const { signal, cleanup } = withTimeout(request.signal, synthesisTimeoutMs);
    let audio: Buffer;
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
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": request.method === "GET" ? "private, max-age=31536000, immutable" : "private, no-store",
        "Vary": "Cookie",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const response = error instanceof SpeechError
    ? NextResponse.json({ error: error.message }, { status: error.status }) : apiError(error);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "请从本站播放发音。");
    const query = new URL(request.url).searchParams;
    const entries = [...query.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length || query.get("v") !== speechCacheVersion) {
      throw new HttpError(400, "发音缓存版本或参数不正确，请刷新页面。");
    }
    const body: Record<string, unknown> = Object.fromEntries(entries.filter(([key]) => key !== "v"));
    if (body.exampleId !== undefined) {
      if (typeof body.exampleId !== "string" || !/^[1-9]\d*$/.test(body.exampleId)) throw new HttpError(400, "例句编号不正确。");
      body.exampleId = Number(body.exampleId);
    }
    return await handle(request, body);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try { return await handle(request, await readJson(request)); }
  catch (error) { return errorResponse(error); }
}
