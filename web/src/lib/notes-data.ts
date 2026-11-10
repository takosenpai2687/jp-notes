import { createHash } from "node:crypto";
import { getNoteContentRecords } from "./content.ts";

export function getNotesDataResponse(request: Request) {
  const payload = JSON.stringify({ notes: getNoteContentRecords() });
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
