import { notesPayloadSchema } from "./note-content";
import type { NotesPayload } from "./note-content";
import type { Level } from "./models";

const cached = new Map<Level, NotesPayload>();
const inFlight = new Map<Level, Promise<NotesPayload>>();

export function getCachedNotes(level: Level) {
  return cached.get(level);
}

export function fetchNotes(level: Level) {
  const existing = inFlight.get(level);
  if (existing) return existing;
  const request = fetch(`/api/notes?level=${level}`, { cache: "no-cache", credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`笔记同步失败（HTTP ${response.status}）。`);
      const result = notesPayloadSchema.safeParse(await response.json());
      if (!result.success) throw new Error(`笔记数据格式无效：${result.error.message}`);
      if (result.data.notes.some((note) => note.level !== level)) throw new Error(`笔记数据等级不匹配：${level}。`);
      cached.set(level, result.data);
      return result.data;
    })
    .finally(() => { if (inFlight.get(level) === request) inFlight.delete(level); });
  inFlight.set(level, request);
  return request;
}
