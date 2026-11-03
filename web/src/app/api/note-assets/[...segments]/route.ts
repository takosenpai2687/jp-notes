import { readFile } from "node:fs/promises";
import path from "node:path";
import { notesRoot } from "@/lib/content";
import { apiError, HttpError } from "@/lib/server";

const mime: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif",
};
export async function GET(_request: Request, context: { params: Promise<{ segments: string[] }> }) {
  try {
    const { segments } = await context.params;
    const filename = path.resolve(notesRoot, ...segments);
    const relative = path.relative(notesRoot, filename);
    const type = mime[path.extname(filename).toLowerCase()];
    if (!type || relative.startsWith("..") || path.isAbsolute(relative)) throw new HttpError(404, "没有找到这张笔记图片。");
    let data: Buffer;
    try { data = await readFile(filename); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new HttpError(404, "笔记图片不存在。");
      throw error;
    }
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) { return apiError(error); }
}
