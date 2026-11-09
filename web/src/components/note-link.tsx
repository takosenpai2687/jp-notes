import Link from "next/link";
import type { ReactNode } from "react";
import type { Level } from "@/lib/models";
import { NoteLinkStatus } from "./note-link-status";

export function NoteLink({ noteId, level, children, className = "", selected, direction, ...props }: {
  noteId: string; level: Level; children: ReactNode; className?: string; selected?: boolean; direction?: -1 | 1; "aria-label"?: string;
}) {
  return (
    <>
      <Link {...props} href={`/notes?level=${level}&note=${noteId}`} scroll={false}
        data-book-direction={direction} data-book-target={noteId}
        className={`${className} note-inline-link`} aria-current={selected ? "page" : undefined}>{children}{!direction && <NoteLinkStatus />}</Link>
      <Link {...props} href={`/notes/${noteId}`} scroll={direction ? false : undefined} data-book-direction={direction} data-book-target={noteId}
        className={`${className} note-detail-link`}>{children}</Link>
    </>
  );
}
