import { notesPayloadSchema } from "./note-content";
import type { NotesPayload } from "./note-content";

let cached: NotesPayload | undefined;
let inFlight: Promise<NotesPayload> | undefined;

export function getCachedNotes() {
  return cached;
}

export function fetchNotes() {
  if (inFlight) return inFlight;
  const request = fetch("/api/notes", { cache: "no-cache", credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`笔记同步失败（HTTP ${response.status}）。`);
      const result = notesPayloadSchema.safeParse(await response.json());
      if (!result.success) throw new Error(`笔记数据格式无效：${result.error.message}`);
      cached = result.data;
      return cached;
    })
    .finally(() => { if (inFlight === request) inFlight = undefined; });
  inFlight = request;
  return request;
}
