import { notFound } from "next/navigation";
import { getCatalog, getNote } from "@/lib/content";
import { isLevel } from "@/lib/models";
import { Library } from "./library";
import type { Section } from "./library";

export async function LibraryPage({ section, searchParams }: {
  section: Section; searchParams: Promise<{ level?: string | string[]; note?: string | string[] }>;
}) {
  const { level = "N5", note: noteId } = await searchParams;
  if (typeof level !== "string" || !isLevel(level)) notFound();
  const catalog = getCatalog();
  if (section !== "notes") return <Library key={`${section}-${level}`} section={section} level={level} catalog={catalog} />;
  if (noteId !== undefined && typeof noteId !== "string") notFound();
  const selectedId = noteId ?? catalog.notes.find((note) => note.level === level)?.id;
  const note = selectedId ? getNote(selectedId) : undefined;
  if (selectedId && (!note || note.level !== level)) notFound();
  return <Library key={`notes-${level}`} section="notes" level={level} catalog={catalog}
    selectedNoteId={note?.id} initialNote={note} />;
}
