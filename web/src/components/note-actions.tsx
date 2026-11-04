"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { Check, CheckCheck, LoaderCircle } from "lucide-react";
import { useApp } from "./app-provider";

export function ReadingMeter() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 150, damping: 30 });
  return <motion.div className="reading-meter" style={{ scaleX }} aria-hidden="true" />;
}

export function NoteReadingPanel({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container });
  const scaleX = useSpring(scrollYProgress, { stiffness: 150, damping: 30 });
  return <div ref={container} className="reader-page reader-embedded">
    <div className="reading-meter-window"><ReadingMeter /></div>
    <motion.div className="reading-meter reading-meter-panel" style={{ scaleX }} aria-hidden="true" />
    {children}
  </div>;
}

export function NoteActions({ noteId }: { noteId: string }) {
  const { progress, markRead, notify, loading } = useApp();
  const read = progress.reads.some((item) => item.noteId === noteId);
  const [busy, setBusy] = useState(false);
  async function mark() {
    setBusy(true);
    try { await markRead(noteId); }
    catch (error) { notify(error instanceof Error ? error.message : "阅读记录未保存，请重试。", true); }
    finally { setBusy(false); }
  }
  return <button className={`button ${read ? "read-button" : "primary"} full`} onClick={mark} disabled={loading || busy || read}>
    {busy ? <LoaderCircle size={18} className="spin" /> : read ? <CheckCheck size={18} /> : <Check size={18} />}
    {read ? "已收入学习足迹" : busy ? "正在保存…" : "读懂了，标记已读"}
  </button>;
}
