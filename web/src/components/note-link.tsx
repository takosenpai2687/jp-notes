import Link from "next/link";
import type { ReactNode } from "react";
import type { Level } from "@/lib/models";

export function NoteLink({ noteId, level, children, className = "", selected, ...props }: {
  noteId: string; level: Level; children: ReactNode; className?: string; selected?: boolean; "aria-label"?: string;
}) {
  return (
    <>
      <Link {...props} href={`/notes?level=${level}&note=${noteId}`} scroll={false}
        className={`${className} note-inline-link`} aria-current={selected ? "page" : undefined}>{children}</Link>
      <Link {...props} href={`/notes/${noteId}`} className={`${className} note-detail-link`}>{children}</Link>
    </>
  );
}
