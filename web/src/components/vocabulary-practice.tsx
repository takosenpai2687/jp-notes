"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, RotateCcw, X } from "lucide-react";
import { useApp } from "./app-provider";
import { SpeechButton } from "./speech-button";
import { summarizeVocabularyAttempt } from "@/lib/vocabulary-models";
import type { VocabularyAttempt, VocabularyLevel, VocabularySummary } from "@/lib/vocabulary-models";
import { formatDuration } from "@/lib/models";

export function VocabularyPractice({ level, words }: { level: VocabularyLevel; words: VocabularySummary[] }) {
  const { user } = useApp();
  return <PracticeRound key={`${user?.id ?? "guest"}-${words.map((word) => word.id).join("-")}`} level={level} words={words} />;
}
function PracticeRound({ level, words }: { level: VocabularyLevel; words: VocabularySummary[] }) {
  const { recordVocabularyAttempt, loading, error: syncError } = useApp();
  const reducedMotion = useReducedMotion();
  const [startedAt] = useState(() => Date.now());
  const [id] = useState(() => crypto.randomUUID());
  const [answers, setAnswers] = useState<{ wordId: string; known: boolean }[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<VocabularyAttempt>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const word = words[answers.length];
  async function save(attempt: VocabularyAttempt) {
    setSaving(true); setError("");
    try { await recordVocabularyAttempt(attempt); setSaved(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "抽背记录未保存，请重试。"); }
    finally { setSaving(false); }
  }
  function answer(known: boolean) {
    if (!revealed || !word || loading || syncError || result) return;
    const next = [...answers, { wordId: word.id, known }];
    setAnswers(next); setRevealed(false);
    if (next.length === words.length) {
      const attempt = summarizeVocabularyAttempt({
        id, level, answers: next, completedAt: new Date().toISOString(),
        durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      });
      setResult(attempt);
      void save(attempt);
    }
  }
  return <div className="vocab-practice">
    <Link className="back-link" href={`/vocabulary?level=${level}`}><ArrowLeft size={17} /> 返回单词花园</Link>
    <header className="vocab-practice-header"><h1>{level} 随机抽背</h1><p>先回忆读音，揭晓后自评。</p></header>
    {result ? <section className="vocab-result" aria-label="抽背结果">
      <h2>这一轮，认识了 {result.known} / {result.total} 个词</h2>
      <p>自评记录 · 用时 {formatDuration(result.durationSeconds)}</p>
      <p role="status">{saving ? "正在保存…" : saved ? "本轮记录已保存" : "本轮记录尚未保存"}</p>
      {error && <div className="inline-error" role="alert">{error}<button className="button secondary" onClick={() => void save(result)} disabled={saving}>重试保存</button></div>}
      <ul className="vocab-result-list">{result.answers.map((answer) => {
        const item = words.find((entry) => entry.id === answer.wordId)!;
        return <li key={item.id}><span>{answer.known ? <Check size={17} aria-label="认识" /> : <X size={17} aria-label="不认识" />}</span>
          <Link href={`/vocabulary?level=${level}&word=${item.id}`}><strong lang="ja">{item.word}</strong><span lang="ja">{item.reading}</span></Link>
          <span lang="en">{item.meanings[0]}</span></li>;
      })}</ul>
      <div className="vocab-practice-actions">
        <a className="button primary" href={`/vocabulary/practice?level=${level}`} aria-disabled={!saved} onClick={(event) => { if (!saved) event.preventDefault(); }}><RotateCcw size={17} /> 再抽 10 词</a>
        <Link className="button secondary" href="/records">查看学习足迹 <ArrowRight size={17} /></Link>
      </div>
    </section> : <>
      <div className="vocab-round-progress"><span>第 {answers.length + 1} / {words.length} 词</span><span>{answers.filter((item) => item.known).length} 个认识</span></div>
      <div className="vocab-round-track"><div style={{ width: `${answers.length / words.length * 100}%` }} /></div>
      <motion.section key={word.id} className="vocab-flashcard" initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .2 }} aria-label="抽背单词">
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
          <button className="button secondary" aria-controls="practice-reading" aria-expanded={revealed} onClick={() => setRevealed((value) => !value)} disabled={loading || !!syncError}>
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}{revealed ? "隐藏读音" : "查看读音"}
          </button>
        </div>
      </motion.section>
      {revealed && <div className="vocab-answer-actions" aria-label="读音自评">
        <button className="button secondary" disabled={loading || !!syncError} onClick={() => answer(false)}><X size={20} /> 不认识</button>
        <button className="button primary" disabled={loading || !!syncError} onClick={() => answer(true)}><Check size={20} /> 认识</button>
      </div>}
    </>}
  </div>;
}
