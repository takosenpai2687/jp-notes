"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, CloudSun, ArrowUpRight, Sparkle, Plus } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function Modal({ open, onOpenChange, title, description, children, className = "" }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string;
  description?: string; children: ReactNode; className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={`dialog-content ${className}`}>
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description className={description ? "dialog-description" : "sr-only"}>
                {description ?? title}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="关闭弹窗"><X size={20} /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CloudFriend({ className = "" }: { className?: string }) {
  return (
    <div className={`cloud-friend ${className}`} aria-hidden="true">
      <div className="cloud-cheek left" /><div className="cloud-cheek right" />
      <i className="cloud-eye left" /><i className="cloud-eye right" /><i className="cloud-smile" />
    </div>
  );
}

export function IslandArt({ kind }: { kind: "quiz" | "notes" | "exams" | "vocabulary" }) {
  return (
    <div className={`island-art art-${kind}`} aria-hidden="true">
      <span className="art-spark spark-one"><Sparkle size={23} strokeWidth={1.4} /></span><span className="art-spark spark-two"><Plus size={17} strokeWidth={1.4} /></span>
      <div className="island-shadow" /><div className="island-base" />
      {kind === "quiz" ? (
        <><div className="kana-tile tile-back">あ</div><div className="kana-tile tile-front">の<span>?</span></div>
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /></>
      ) : kind === "notes" ? (
        <><div className="art-book"><div className="book-page"><span>日</span><i /><i /></div>
          <div className="book-page"><span>本</span><i /><i /></div></div><div className="book-bookmark" /></>
      ) : kind === "exams" ? (
        <><div className="art-ticket"><span>JLPT</span><i /><b>合格</b><i /></div><div className="ticket-seal">◎</div></>
      ) : (
        <><div className="word-tile word-back">そら<span>sora</span></div>
          <div className="word-tile word-front">空<span>天空</span></div></>
      )}
      <span className="island-pebble pebble-one" /><span className="island-pebble pebble-two" />
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <CloudSun size={44} strokeWidth={1.3} />
      <h2>{title}</h2><p>{children}</p>{action}
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, aside }: {
  eyebrow: string; title: string; description: string; aside?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-description">{description}</p></div>
      {aside}
    </div>
  );
}

export function Arrival({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} initial={{ y: 12 }} animate={{ y: 0 }}
    transition={{ duration: .45, delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}

export function ArrowCircle() {
  return <span className="arrow-circle" aria-hidden="true"><ArrowUpRight size={20} /></span>;
}
