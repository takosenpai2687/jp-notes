import { createHash } from "node:crypto";
import { isLevel } from "./models";
import { getNoteContentRecords } from "./content.ts";

export function getNotesDataResponse(request: Request) {
  const params = new URL(request.url).searchParams;
  const level = params.get("level");
  if ([...params].length !== 1 || !level || !isLevel(level)) {
    return new Response(JSON.stringify({ error: "笔记等级不正确。" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const payload = JSON.stringify({ notes: getNoteContentRecords(level) });
  const etag = `"${createHash("sha256").update(payload).digest("hex")}"`;
  const headers = {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Content-Type": "application/json; charset=utf-8",
    "ETag": etag,
    "X-Content-Type-Options": "nosniff",
  };
  const validators = request.headers.get("if-none-match")?.split(",").map((value) => value.trim()) ?? [];
  if (validators.includes("*") || validators.includes(etag) || validators.includes(`W/${etag}`)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(payload, { headers });
}
