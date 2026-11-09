"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useScroll, useSpring } from "motion/react";

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
