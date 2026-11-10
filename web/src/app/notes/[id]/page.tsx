import { notFound } from "next/navigation";
import { getCatalog, getNote } from "@/lib/content";
import { Library } from "@/components/library";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const note = getNote((await params).id);
  if (!note) notFound();
  return <Library key={`notes-${note.level}`} section="notes" level={note.level} catalog={getCatalog()}
    selectedNoteId={note.id} detail initialNote={note} />;
}
