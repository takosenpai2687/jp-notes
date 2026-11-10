import GithubSlugger from "github-slugger";
import type { Level, NoteSummary } from "./models";

export function noteOutline(markdown: string) {
  const slugger = new GithubSlugger();
  let inFence = false;
  const headings: { id: string; text: string; depth: number }[] = [];
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[*`]/g, "").trim();
    const id = slugger.slug(text);
    if (match[1].length > 1) headings.push({ id, text, depth: match[1].length });
  }
  return headings;
}

export function resolveNoteUrl(note: { level: Level; filename: string }, href: string, notes: NoteSummary[]) {
  if (/^(https?:|mailto:|#)/i.test(href)) return href;
  let decoded: string;
  try { decoded = decodeURIComponent(href); }
  catch { return ""; }
  const [filename, hash = ""] = decoded.split("#");
  if (!filename) return "";
  let target: URL;
  try {
    target = new URL(filename, `https://notes.invalid/notes/${note.level.toLowerCase()}/${encodeURIComponent(note.filename)}`);
  } catch {
    return "";
  }
  if (target.origin !== "https://notes.invalid" || !target.pathname.startsWith("/notes/") || target.search) return "";
  let relative: string;
  try {
    relative = target.pathname.slice("/notes/".length).split("/").map(decodeURIComponent).join("/");
  } catch {
    return "";
  }
  if (/\.md$/i.test(relative)) {
    const linked = notes.find((item) =>
      `${item.level.toLowerCase()}/${item.filename}`.normalize("NFC") === relative.normalize("NFC"));
    return linked ? `/notes/${linked.id}${hash ? `#${encodeURIComponent(hash)}` : ""}` : "";
  }
  if (/\.(png|jpe?g|gif|webp)$/i.test(relative)) {
    return `/api/note-assets/${relative.split("/").map(encodeURIComponent).join("/")}`;
  }
  return "";
}
