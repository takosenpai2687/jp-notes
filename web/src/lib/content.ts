import { cache } from "react";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import { levels, quizSchema } from "./models.ts";
import type { Catalog, Level, Note, Quiz } from "./models.ts";

export const contentRoot = process.env.NODE_ENV === "production"
  ? path.join(process.cwd(), ".netlify-content")
  : path.resolve(process.cwd(), "..");
export const notesRoot = path.join(contentRoot, "notes", "raw");

function contentId(level: Level, filename: string) {
  return `${level.toLowerCase()}-${createHash("sha256").update(filename.normalize("NFC")).digest("hex").slice(0, 12)}`;
}

function filesAt(directory: string, extension: string) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
}

export const loadContent = cache(() => {
  if (!existsSync(path.join(contentRoot, "quiz")) || !existsSync(notesRoot)) {
    throw new Error("Learning content is missing. Run npm run build to package the quiz and notes sources.");
  }
  const quizzes: Quiz[] = [];
  const notes: Note[] = [];
  for (const level of levels) {
    const folder = level.toLowerCase();
    const quizFiles = filesAt(path.join(contentRoot, "quiz", folder), ".json");
    for (const filename of quizFiles) {
      const raw = readFileSync(path.join(contentRoot, "quiz", folder, filename), "utf8");
      const result = quizSchema.safeParse(JSON.parse(raw.replace(/^\uFEFF/, "")));
      if (!result.success) throw new Error(`Invalid quiz ${folder}/${filename}: ${result.error.message}`);
      if (result.data.level !== level) throw new Error(`Quiz level mismatch: ${filename}`);
      quizzes.push({
        ...result.data, id: contentId(level, filename), count: result.data.questions.length,
        version: createHash("sha256").update(raw).digest("hex").slice(0, 20),
      });
    }
    for (const filename of filesAt(path.join(notesRoot, folder), ".md")) {
      const markdown = readFileSync(path.join(notesRoot, folder, filename), "utf8").replace(/^\uFEFF/, "");
      const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? filename.replace(/\.md$/, "");
      const paired = quizFiles
        .find((file) => file.slice(0, -5).normalize("NFC") === filename.slice(0, -3).normalize("NFC"));
      const quiz = paired ? quizzes.find((item) => item.id === contentId(level, paired)) : undefined;
      const id = contentId(level, filename);
      if (quiz) quiz.noteId = id;
      notes.push({
        id, title, level, filename, markdown, quizId: quiz?.id,
        no: filename.match(/^\d+(?:\.\d+(?=\.))?/)?.[0] ?? "—",
        minutes: Math.max(1, Math.ceil(markdown.length / 450)),
        excerpt: markdown.replace(/^#.+$/gm, "").replace(/<[^>]+>|[*|>#`[\]]/g, " ")
          .replace(/\s+/g, " ").trim().slice(0, 85),
      });
    }
  }
  return { quizzes, notes };
});

export function getCatalog(): Catalog {
  const { quizzes, notes } = loadContent();
  return {
    quizzes: quizzes.map((item) => ({
      id: item.id, title: item.title, level: item.level, no: item.no,
      count: item.count, version: item.version, noteId: item.noteId,
    })),
    notes: notes.map((item) => ({
      id: item.id, title: item.title, level: item.level, no: item.no,
      minutes: item.minutes, excerpt: item.excerpt, quizId: item.quizId,
    })),
  };
}
export function getQuiz(id: string) {
  return loadContent().quizzes.find((quiz) => quiz.id === id);
}
export function getNote(id: string) {
  return loadContent().notes.find((note) => note.id === id);
}

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

export function noteUrl(note: Note, href: string): string {
  if (/^(https?:|mailto:|#)/i.test(href)) return href;
  let decoded: string;
  try { decoded = decodeURIComponent(href); }
  catch { return ""; }
  const [filename, hash = ""] = decoded.split("#");
  const target = path.resolve(notesRoot, note.level.toLowerCase(), filename);
  const relative = path.relative(notesRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
  if (/\.md$/i.test(filename)) {
    const linked = loadContent().notes.find((item) =>
      path.join(item.level.toLowerCase(), item.filename).normalize("NFC") === relative.normalize("NFC"));
    return linked ? `/notes/${linked.id}${hash ? `#${encodeURIComponent(hash)}` : ""}` : "";
  }
  if (/\.(png|jpe?g|gif|webp)$/i.test(filename)) {
    return `/api/note-assets/${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
  }
  return "";
}
