import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { credentialsSchema } from "@/lib/models";
import {
  clearAuthLimit, consumeAuthLimit, createSession, deleteSession, findUser,
  hashPassword, insertUser, sessionSeconds, usernameKey, verifyPassword,
} from "@/lib/database";
import { apiError, HttpError, readJson, sessionCookie } from "@/lib/server";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await context.params;
    const body = await readJson(request);
    const jar = await cookies();
    if (action === "logout") {
      const token = jar.get(sessionCookie)?.value;
      if (token) await deleteSession(token);
      jar.delete(sessionCookie);
      return NextResponse.json({ user: null });
    }
    if (action !== "login" && action !== "register") throw new HttpError(404, "没有这个账号操作。");
    const { username, password } = credentialsSchema.parse(body);
    const key = `${action}:${usernameKey(username)}`;
    if (!await consumeAuthLimit(key)) throw new HttpError(429, "尝试次数较多，请 15 分钟后再试。");
    let user;
    if (action === "register") {
      const passwordHash = await hashPassword(password);
      user = await insertUser(username, passwordHash);
      if (!user) throw new HttpError(409, "这个用户名已经被使用，换一个试试。");
    } else {
      const found = await findUser(username);
      // Unknown users also pay the scrypt cost to avoid a fast username probe.
      const valid = await verifyPassword(password, found?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`);
      if (!found || !valid) throw new HttpError(401, "用户名或密码不正确。");
      user = { id: found.id, username: found.username };
    }
    const previous = jar.get(sessionCookie)?.value;
    if (previous) await deleteSession(previous);
    const token = await createSession(user.id);
    await clearAuthLimit(key);
    jar.set(sessionCookie, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: sessionSeconds,
    });
    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error);
  }
}
