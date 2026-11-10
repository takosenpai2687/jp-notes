"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, RotateCcw, Sparkles } from "lucide-react";
import { useApp } from "./app-provider";
import { SpeechButton } from "./speech-button";
import { ContentTransition } from "./content-transition";
import type { VocabularyLevel, VocabularySummary } from "@/lib/vocabulary-models";

export function VocabularyPractice({ level, words }: { level: VocabularyLevel; words: VocabularySummary[] }) {
  const { user } = useApp();
  return <PracticeRound key={`${user?.id ?? "guest"}-${words.map((word) => word.id).join("-")}`} level={level} words={words} />;
}
function PracticeRound({ level, words }: { level: VocabularyLevel; words: VocabularySummary[] }) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const word = words[index];
  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, []);
  function navigate(direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= words.length) return;
    setIndex(next);
  }
  return <ContentTransition transitionKey={word.id} className="practice-transition" backgroundHue={index * 360 / words.length}>
  <div className="vocab-practice">
    <Link className="back-link" href={`/vocabulary?level=${level}`}>
      <span className="practice-back-glyph"><ArrowLeft size={17} /></span><span>返回单词花园</span>
    </Link>
    <header className="vocab-practice-header">
      <div className="practice-level-label"><Sparkles size={14} /><span>JLPT {level}</span><span>轻松复习</span></div>
      <h1>随机抽背</h1><p>慢慢回忆，自由翻看。</p>
    </header>
      <div className="vocab-round-progress">
        <div className="practice-progress-counter">
          <div className="practice-progress-caption"><span>本轮进度</span><span>还剩 {words.length - index - 1} 词</span></div>
          <div className="practice-progress-number" aria-live="polite">
            <span className="sr-only">第 {index + 1} / {words.length} 词</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={index} initial={reducedMotion ? false : { opacity: 0, y: 8, scale: .86 }}
                animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .86 }}
                transition={{ duration: reducedMotion ? 0 : .18 }}>{String(index + 1).padStart(2, "0")}</motion.span>
            </AnimatePresence>
            <span>/ {String(words.length).padStart(2, "0")} 词</span>
          </div>
        </div>
        <a className="practice-restart" href={`/vocabulary/practice?level=${level}`}><RotateCcw size={15} /> 重抽本轮</a>
      </div>
      <div className="vocab-round-track" role="progressbar" aria-label="抽背进度"
        aria-valuemin={1} aria-valuemax={words.length} aria-valuenow={index + 1}
        aria-valuetext={`第 ${index + 1} / ${words.length} 词`}>
        {words.map((_, step) => <span key={step} aria-hidden="true"
          className={step < index ? "is-complete" : step === index ? "is-current" : undefined} />)}
      </div>
      <section key={word.id} className="vocab-flashcard" aria-label="抽背单词">
        <div className="vocab-prompt">
          <h2 lang="ja">{word.word}</h2>
          <div className="vocab-reading-slot" id="practice-reading" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={revealed ? "reading" : "hidden"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .18 }}>
                {revealed ? <><div className="vocab-reading-line"><SpeechButton target={{ level, wordId: word.id, kind: "reading" }} label={`${word.word}的读音`} /><p className="vocab-reading" lang="ja">{word.reading}</p></div><p className="vocab-romaji">{word.romaji}</p></> :
                  <span className="vocab-reading-cover" aria-label="读音已隐藏">...</span>}
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="vocab-prompt-meaning" lang="en">{word.meanings.join("; ")}</p>
          <button className="button secondary" aria-controls="practice-reading" aria-expanded={revealed} onClick={() => setRevealed((value) => !value)}>
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}{revealed ? "隐藏读音" : "查看读音"}
          </button>
          <nav className="vocab-browse-actions" aria-label="单词导航">
            <button disabled={index === 0} onClick={() => navigate(-1)}><ArrowLeft size={26} /><span>上一个</span></button>
            <button disabled={index === words.length - 1} onClick={() => navigate(1)}><ArrowRight size={26} /><span>下一个</span></button>
          </nav>
        </div>
      </section>
  </div>
  </ContentTransition>;
}
