"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock3,
  Flag, Grid2X2, Lightbulb, LoaderCircle, RotateCcw, Send, Sparkles, Trophy, X,
} from "lucide-react";
import { gradeQuiz, formatDuration } from "@/lib/models";
import type { Attempt, Quiz } from "@/lib/models";
import { parseDraft } from "@/lib/draft";
import type { Draft } from "@/lib/draft";
import { useApp } from "./app-provider";
import { CloudFriend, Modal } from "./ui";

const subscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

function freshDraft(quiz: Quiz): Draft {
  return { id: crypto.randomUUID(), version: quiz.version, answers: Array(quiz.count).fill(null), index: 0, startedAt: Date.now() };
}
function initialDraft(quiz: Quiz, key: string) {
  const fresh = freshDraft(quiz);
  if (typeof window === "undefined") return { draft: fresh, error: "", resumed: false };
  try {
    const raw = localStorage.getItem(key);
    return { draft: raw ? parseDraft(raw, quiz) : fresh, error: "", resumed: !!raw };
  } catch (error) {
    return { draft: fresh, error: error instanceof Error ? error.message : "无法读取草稿，请检查浏览器存储设置。", resumed: false };
  }
}

export function QuizPlayer({ quiz }: { quiz: Quiz }) {
  const { user } = useApp();
  return <QuizSession key={`${quiz.id}-${user?.id ?? "guest"}`} quiz={quiz} scope={user?.id ?? "guest"} />;
}

function QuizSession({ quiz, scope }: { quiz: Quiz; scope: string }) {
  const storageKey = `tako-jp:draft:${scope}:${quiz.id}`;
  const [initial] = useState(() => initialDraft(quiz, storageKey));
  const [draft, setDraft] = useState(initial.draft);
  const draftRef = useRef(initial.draft);
  const [storageError, setStorageError] = useState(initial.error);
  const storageBlocked = useRef(!!initial.error);
  const [seconds, setSeconds] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const { recordAttempt, user } = useApp();
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const { answers, index } = draft;
  const question = quiz.questions[index];
  const selected = answers[index];
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const correctCount = quiz.questions.filter((item, position) => answers[position] === item.answer).length;
  const draftBlocked = !!initial.error && !!storageError;

  const updateDraft = useCallback((update: (previous: Draft) => Draft) => {
    const next = update(draftRef.current);
    draftRef.current = next;
    setDraft(next);
    if (storageBlocked.current || result) return;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch {
      storageBlocked.current = true;
      setStorageError("草稿未能保存到浏览器。当前答题还在页面中，请勿关闭，或登录后提交成绩。");
    }
  }, [storageKey, result]);
  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => setSeconds(Math.max(0, Math.floor((Date.now() - draft.startedAt) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [draft.startedAt, result]);

  const choose = useCallback((option: number) => {
    if (result || storageBlocked.current && initial.error) return;
    updateDraft((previous) => {
      if (previous.answers[previous.index] !== null) return previous;
      return { ...previous, answers: previous.answers.map((answer, position) => position === previous.index ? option : answer) };
    });
  }, [result, initial.error, updateDraft]);
  const move = useCallback((position: number) => {
    updateDraft((previous) => ({ ...previous, index: Math.min(quiz.count - 1, Math.max(0, position)) }));
  }, [quiz.count, updateDraft]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (mapOpen || confirmOpen || restartOpen || (result && !reviewing)) return;
      if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, [role="dialog"]') || event.target.isContentEditable)) return;
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); choose(Number(event.key) - 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(index + 1); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [choose, move, index, mapOpen, confirmOpen, restartOpen, result, reviewing]);

  async function save(attempt: Attempt) {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError("");
    try {
      await recordAttempt(attempt);
      setSaved(true);
      try { localStorage.removeItem(storageKey); }
      catch { setStorageError("成绩已保存，但本机旧草稿未能清理。下次打开时可点击重新开始。"); }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "本次记录未能保存，请点击重试。");
    } finally { savingRef.current = false; setSaving(false); }
  }
  function finish() {
    setConfirmOpen(false);
    const attempt = gradeQuiz(quiz, {
      id: draft.id, quizId: quiz.id, version: quiz.version, answers,
      durationSeconds: Math.max(0, Math.floor((Date.now() - draft.startedAt) / 1000)),
      completedAt: new Date().toISOString(),
    });
    setResult(attempt); setReviewing(false);
    void save(attempt);
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
  }
  function restart() {
    setRestartOpen(false);
    storageBlocked.current = false;
    setStorageError("");
    updateDraft(() => freshDraft(quiz)); setResult(null); setSaved(false); setSeconds(0); setReviewing(false); setSaveError("");
  }

  function questionMap() {
    return (
      <>
        <div className="question-map" aria-label="选题目录">
          {quiz.questions.map((item, position) => {
            const answer = answers[position];
            const state = answer === null ? "unanswered" : answer === item.answer ? "correct" : "wrong";
            return <button key={position} className={`question-dot ${state} ${position === index ? "current" : ""}`}
              onClick={() => { move(position); setMapOpen(false); }} aria-current={position === index ? "step" : undefined}
              aria-label={`第 ${position + 1} 题，${state === "unanswered" ? "未作答" : state === "correct" ? "答对" : "答错"}`}>
              {position + 1}
            </button>;
          })}
        </div>
        <div className="map-legend"><span><i className="legend-dot correct" /> 答对</span><span><i className="legend-dot wrong" /> 答错</span><span><i className="legend-dot unanswered" /> 未答</span></div>
        <p className="map-hint">点一个数字，就能回到那道题。<br />先跳过也没关系，随时回来想一想。</p>
      </>
    );
  }

  if (!hydrated) return <div className="loading-panel" role="status"><span className="loading-cloud" /> 正在准备你的语法小挑战…</div>;
  return (
    <div className="quiz-page">
      <Link href={`/quiz?level=${quiz.level}`} className="back-link"><ArrowLeft size={17} /> 返回语法试炼 <span>/ {quiz.level} 航线</span></Link>
      <div className="quiz-heading"><div><p className="eyebrow"><Flag size={14} /> {quiz.level} · 第 {quiz.no} 课</p><h1>{quiz.title}<span>小小试炼</span></h1>
        <p>{result ? "每一次认真尝试，都让理解更深一点。" : "选错也没关系，答案就在下一次理解里。"}</p></div>
        <div className="quiz-clock"><Clock3 size={17} /><span>{formatDuration(result?.durationSeconds ?? seconds)}</span></div>
      </div>
      {storageError && <div className="sync-warning" role="alert"><span>{storageError}</span><button onClick={() => setRestartOpen(true)} disabled={saving}>重新开始</button></div>}
      {result && !reviewing ? (
        <motion.section className="quiz-result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {!reducedMotion && <div className="confetti-field" aria-hidden="true">{Array.from({ length: 14 }, (_, i) =>
            <motion.i key={i} style={{ left: `${7 + i * 6.5}%`, background: ["#68c4ec", "#f7cc71", "#86d9ba", "#f5a99a"][i % 4] }}
              initial={{ y: -40, opacity: 0, rotate: i * 30 }} animate={{ y: [0, 140, 280], x: [0, (i % 2 ? 1 : -1) * 28], opacity: [0, 1, 0], rotate: i * 30 + 200 }} transition={{ duration: 2.4, delay: i * .06 }} />)}</div>}
          <div className="result-mascot"><CloudFriend /><span>おつかれさま！</span></div>
          <div className="result-ring"><svg viewBox="0 0 160 160" aria-label={`正确率 ${result.percent}%`}><circle cx="80" cy="80" r="65" className="ring-track" />
            <motion.circle cx="80" cy="80" r="65" className="ring-value" strokeDasharray={408.4} initial={{ strokeDashoffset: 408.4 }}
              animate={{ strokeDashoffset: 408.4 * (1 - result.percent / 100) }} transition={{ duration: 1.2, ease: "easeOut" }} /></svg>
            <div><strong>{result.percent}<small>%</small></strong><span>本次正确率</span></div></div>
          <h2>{result.percent >= 80 ? "这座小岛，被你点亮了！" : result.percent >= 50 ? "又读懂了一些，真不错。" : "迈出这一步，就已经很棒。"}</h2>
          <p>不用和别人比较，这些小小进步都属于你。</p>
          <div className="result-stats"><div><Check size={18} /><strong>{result.correct}</strong><span>答对</span></div>
            <div><X size={18} /><strong>{result.answered - result.correct}</strong><span>待巩固</span></div>
            <div><Flag size={18} /><strong>{result.total - result.answered}</strong><span>留白</span></div>
            <div><Clock3 size={18} /><strong>{formatDuration(result.durationSeconds)}</strong><span>用时</span></div></div>
          <div className="result-save" role="status">{saving ? <><LoaderCircle size={16} className="spin" /> 正在保存本次足迹…</> : saved ? <><Check size={16} /> {user ? "成绩已保存到你的账号" : "成绩已保存在此浏览器"}</> : null}</div>
          {saveError && <div className="save-error" role="alert"><p>{saveError}</p><button className="button secondary" onClick={() => void save(result)} disabled={saving}>重试保存</button><small>请先保留本页，答题草稿仍在本机。</small></div>}
          <div className="result-actions"><button className="button primary" onClick={() => setReviewing(true)}>回看题目与解析 <BookOpen size={17} /></button>
            <button className="button secondary" disabled={saving} onClick={() => setRestartOpen(true)}><RotateCcw size={17} /> 再挑战一次</button></div>
          <Link className="text-button" href="/records">看看我的学习足迹 <ArrowRight size={16} /></Link>
        </motion.section>
      ) : (
        <>
          {initial.resumed && !result && <p className="resume-notice"><Check size={14} /> 已接上上次的小脚步，之前的选择都在。</p>}
          {reviewing && <div className="review-banner"><BookOpen size={17} /> 正在回看本次挑战，选择不再变更。<button onClick={() => setReviewing(false)}>返回成绩单 <ArrowRight size={15} /></button></div>}
          <div className="quiz-progress-row"><div className="quiz-progress-track"><motion.div animate={{ width: `${answeredCount / quiz.count * 100}%` }} transition={{ type: "spring", stiffness: 100, damping: 22 }} /></div>
            <span>已作答 <strong>{answeredCount}</strong> / {quiz.count}</span><button className="map-toggle" onClick={() => setMapOpen(true)}><Grid2X2 size={17} /> 选题目录</button></div>
          <div className="quiz-layout">
            <div className="quiz-main">
              <AnimatePresence mode="wait" initial={false}>
                <motion.section className="question-card" key={index} initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .18 }}>
                  <div className="question-topline"><span>QUESTION <b>{String(index + 1).padStart(2, "0")}</b><small>/ {String(quiz.count).padStart(2, "0")}</small></span><span className="question-source">{question.source}</span></div>
                  <h2 className="question-stem" lang="ja">{question.stem.split(/(＿+)/g).map((part, position) =>
                    /^＿+$/.test(part) ? <span className={`stem-blank ${selected !== null ? "filled" : ""}`} key={position}>{selected !== null ? question.options[question.answer] : "　　　"}</span> : part)}</h2>
                  <p className="question-instruction">选出最适合填入空白处的一项</p>
                  <div className="question-options" role="group" aria-label="回答选项">
                    {question.options.map((option, position) => {
                      const correct = selected !== null && position === question.answer;
                      const wrong = selected === position && position !== question.answer;
                      return <motion.button key={position} whileHover={selected === null ? { y: -2, x: 3 } : {}}
                        whileTap={selected === null ? { scale: .99 } : {}} onClick={() => choose(position)}
                        disabled={selected !== null || !!result || draftBlocked}
                        aria-pressed={selected === position} className={`quiz-option ${correct ? "option-correct" : ""} ${wrong ? "option-wrong" : ""}`}>
                        <span className="option-key">{String.fromCharCode(65 + position)}</span><span lang="ja">{option}</span>
                        <span className="option-shortcut">{correct ? <Check size={20} /> : wrong ? <X size={20} /> : position + 1}</span>
                      </motion.button>;
                    })}
                  </div>
                  <AnimatePresence>
                    {selected !== null && <motion.div key="explanation" className={`answer-explanation ${selected === question.answer ? "answer-correct" : "answer-wrong"}`}
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={{ duration: .25 }} role="status">
                      <div><strong>{selected === question.answer ? <><Sparkles size={17} /> 答对啦，就是这样！</> : <><Lightbulb size={17} /> 再靠近答案一点点</>}</strong><p>{question.explain}</p>
                        <p className="translation"><span>译</span>{question.translation}</p>{question.tip && <p className="answer-tip"><Lightbulb size={14} /> {question.tip}</p>}</div>
                    </motion.div>}
                    {reviewing && selected === null && <motion.div className="answer-explanation answer-skipped" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div><strong>这道题留下了空白 · 正确答案 {String.fromCharCode(65 + question.answer)}</strong><p>{question.explain}</p><p className="translation"><span>译</span>{question.translation}</p>{question.tip && <p className="answer-tip">{question.tip}</p>}</div>
                    </motion.div>}
                  </AnimatePresence>
                  <div className="question-navigation"><button className="button secondary" onClick={() => move(index - 1)} disabled={index === 0}><ChevronLeft size={18} /> 上一题</button>
                    <span>{index + 1} / {quiz.count}</span>
                    {index < quiz.count - 1 ? <button className="button primary" onClick={() => move(index + 1)}>{selected === null && !reviewing ? "先跳过" : "下一题"}<ChevronRight size={18} /></button> :
                      reviewing ? <button className="button primary" onClick={() => setReviewing(false)}>回到成绩单 <Trophy size={17} /></button> :
                        <button className="button primary" disabled={draftBlocked} onClick={() => setConfirmOpen(true)}>完成挑战 <Flag size={17} /></button>}
                  </div>
                </motion.section>
              </AnimatePresence>
              <div className="quiz-helper"><span><Check size={14} /> {result ? "本次挑战已结束" : storageError ? "草稿保存遇到问题" : "答题草稿自动保存在本机"}</span><span className="keyboard-hint"><kbd>1</kbd>–<kbd>4</kbd> 选择 <kbd>←</kbd><kbd>→</kbd> 切题</span></div>
              <details className="quiz-summary"><summary><Lightbulb size={17} /> 行前小抄 · 本课知识点<span>点击展开</span></summary><ul>{quiz.summary.map((text, position) => <li key={position}>{text}</li>)}</ul></details>
            </div>
            <aside className="quiz-aside"><section className="quiz-map-card"><h2><Grid2X2 size={17} /> 这次挑战的地图 <span>{quiz.count} 题</span></h2>
              {questionMap()}<div className="map-stats"><span>已答 <b>{answeredCount}</b></span><span>答对 <b>{correctCount}</b></span><span>留白 <b>{quiz.count - answeredCount}</b></span></div>
              {!result && <button className="button primary full" disabled={draftBlocked} onClick={() => setConfirmOpen(true)}><Send size={16} /> 提交本次挑战</button>}</section>
              <div className="quiz-aside-note"><CloudFriend /><h3>不会，也可以先路过。</h3><p>没选答案就点下一题，它会留在原处等你。第一次选择会计分，回看时不能改答案。</p>
                {quiz.noteId && <Link href={`/notes/${quiz.noteId}`} className="text-button"><BookOpen size={15} /> 看看这课的笔记 <ArrowRight size={15} /></Link>}</div>
            </aside>
          </div>
        </>
      )}
      <Modal open={mapOpen} onOpenChange={setMapOpen} title="这次挑战的地图" description="点击题号直接跳转，已作答的题目可以回看解析。">{questionMap()}</Modal>
      <Modal open={confirmOpen} onOpenChange={setConfirmOpen} title="准备收下这次的小进步？" description="提交后会生成成绩单，所有题目仍可回看解析。">
        <div className="submit-summary"><Flag size={30} /><strong>已作答 {answeredCount} / {quiz.count} 题</strong>
          <p>{answeredCount < quiz.count ? `还有 ${quiz.count - answeredCount} 道题留白。你可以回去想一想，也可以现在提交；留白题按未答对计分。` : "每一道都认真走过了。准备好看看这次的收获了吗？"}</p></div>
        <div className="dialog-actions"><button className="button secondary" onClick={() => setConfirmOpen(false)}>回去看看</button><button className="button primary" onClick={finish}>确认提交 <Send size={16} /></button></div>
      </Modal>
      <Modal open={restartOpen} onOpenChange={setRestartOpen} title="重新开启一次小挑战？" description="本次未提交的草稿会被替换，已经保存的历史成绩不会删除。">
        <div className="dialog-actions"><button className="button secondary" onClick={() => setRestartOpen(false)}>先留着</button><button className="button primary" onClick={restart} disabled={saving}><RotateCcw size={16} /> 重新开始</button></div>
      </Modal>
    </div>
  );
}
