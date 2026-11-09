"use client";

import { useLinkStatus } from "next/link";

export function NoteLinkStatus() {
  const { pending } = useLinkStatus();
  return pending ? <span className="note-link-pending" aria-hidden="true" /> : null;
}
