import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { sessionUser } from "./database.ts";

export const sessionCookie = "tako-session";
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  return token ? sessionUser(token) : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "登录已过期，请重新登录；未保存的答题仍留在本机。");
  return user;
}
export async function readJson(request: Request) {
  let origin: URL;
  try { origin = new URL(request.headers.get("origin") ?? ""); }
  catch { throw new HttpError(403, "请求来源不匹配，请从本站重新操作。"); }
  // Next can normalize request.url to localhost; Host preserves the browser-facing authority.
  if (!["http:", "https:"].includes(origin.protocol) || origin.host !== request.headers.get("host") || origin.username || origin.password) {
    throw new HttpError(403, "请求来源不匹配，请从本站重新操作。");
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "请求需要使用 JSON 格式。");
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > 1024 * 1024) throw new HttpError(413, "提交内容过大，请分批保存。");
  return JSON.parse(text) as unknown;
}
export function apiError(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "提交的数据格式不正确。" }, { status: 400 });
  }
  if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON 格式不正确。" }, { status: 400 });
  console.error("[tako-jp] API request failed", error);
  return NextResponse.json({ error: "保存服务暂时出了点问题，请稍后重试。" }, { status: 500 });
}
