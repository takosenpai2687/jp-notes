"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookCheck, Check, Clock3, Download, Flag, Footprints, Trophy } from "lucide-react";
import { useApp } from "./app-provider";
import { Arrival, EmptyState } from "./ui";
import { formatDate, formatDuration, levels } from "@/lib/models";
import type { Catalog } from "@/lib/models";

export function Records({ catalog, vocabularyLabels }: { catalog: Catalog; vocabularyLabels: Record<string, string> }) {
  const { user, progress, loading, error, openAuth } = useApp();
  const [tab, setTab] = useState<"attempts" | "reads">("attempts");
  const [level, setLevel] = useState("all");
  const [visible, setVisible] = useState(20);
  const [visibleVocabulary, setVisibleVocabulary] = useState(20);
  const totalQuestions = progress.attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const totalCorrect = progress.attempts.reduce((sum, attempt) => sum + attempt.correct, 0);
  const average = totalQuestions ? Math.round(totalCorrect / totalQuestions * 100) : null;
  const attempts = progress.attempts.filter((attempt) => level === "all" || attempt.level === level);
  const reads = progress.reads.map((read) => ({ ...read, note: catalog.notes.find((note) => note.id === read.noteId) }))
    .filter((read) => level === "all" || read.note?.level === level);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + index);
    const end = new Date(date); end.setDate(end.getDate() + 1);
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: progress.attempts.filter((attempt) => Date.parse(attempt.completedAt) >= date.getTime() && Date.parse(attempt.completedAt) < end.getTime()).length,
    };
  });
  const maxActivity = Math.max(1, ...dates.map((day) => day.count));
  function download() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...progress }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `tako-jp-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="records-page">
      {!user && <div className="record-guest-banner"><Footprints size={22} /><span><strong>给这些小小的努力，一个自己的家。</strong><small>注册或登录后，游客记录会自动合并到账号，本机副本继续保留。</small></span><button className="button primary" onClick={openAuth}>领取学习护照 <ArrowRight size={16} /></button></div>}
      <Arrival className="record-overview">
        <section className="record-numbers">
          <div><span><Flag size={16} /> 完成挑战</span><strong>{loading ? "—" : progress.attempts.length}<small>次</small></strong></div>
          <div><span><Trophy size={16} /> 累计正确率</span><strong>{loading || average === null ? "—" : average}<small>{average === null ? "" : "%"}</small></strong></div>
          <div><span><BookCheck size={16} /> 历史已读笔记</span><strong>{loading ? "—" : progress.reads.length}<small>篇</small></strong></div>
        </section>
        <section className="activity-card"><div className="card-title-row"><h2>最近 7 天的小脚步</h2><span>{loading ? "—" : dates.reduce((sum, day) => sum + day.count, 0)} 次挑战</span></div>
          <div className="activity-chart" aria-label="最近七天每天的测验次数">
            {dates.map((day) => <div className="activity-column" key={day.label}><span>{loading ? "—" : day.count}</span><div className="activity-track"><div style={{ height: `${loading ? 0 : day.count / maxActivity * 100}%` }} /></div><small>{day.label}</small></div>)}
          </div>
        </section>
      </Arrival>
      <section className="vocab-history" aria-label="单词抽背记录">
        <div className="card-title-row"><h2>单词抽背 <span>自评</span></h2><Link href="/vocabulary">去抽背 <ArrowRight size={16} /></Link></div>
        {progress.vocabularyAttempts.length ? <ul>{progress.vocabularyAttempts.slice(0, visibleVocabulary).map((attempt) =>
          <li key={attempt.id}><strong>{attempt.level} · 认识 {attempt.known} / {attempt.total}</strong>
            <span>{formatDate(attempt.completedAt)} · {formatDuration(attempt.durationSeconds)}</span>
            <div>{attempt.answers.filter((answer) => !answer.known).length ? <>
              <span>待复习</span>{attempt.answers.filter((answer) => !answer.known).map((answer) =>
                <Link key={answer.wordId} href={`/vocabulary?level=${attempt.level}&word=${answer.wordId}`}>{vocabularyLabels[`${attempt.level}-${answer.wordId}`] ?? "已归档单词"}</Link>)}
            </> : <span>本轮全部认识</span>}</div>
          </li>)}</ul> : <p>{loading ? "正在整理抽背记录…" : error ? "抽背记录尚未同步，请先重试上方的同步操作。" : "完成一轮 10 词抽背，记录会保存在这里。"}</p>}
        {progress.vocabularyAttempts.length > visibleVocabulary && <button className="button secondary" onClick={() => setVisibleVocabulary((count) => count + 20)}>更多抽背记录</button>}
      </section>
      <div className="records-toolbar">
        <div className="filter-pills"><button className={tab === "attempts" ? "selected" : ""} onClick={() => { setTab("attempts"); setVisible(20); }}>挑战记录 <span>{attempts.length}</span></button>
          <button className={tab === "reads" ? "selected" : ""} onClick={() => { setTab("reads"); setVisible(20); }}>历史阅读足迹 <span>{reads.length}</span></button></div>
        <label className="record-level">航线 <select value={level} onChange={(event) => { setLevel(event.target.value); setVisible(20); }}><option value="all">全部等级</option>{levels.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="button secondary" onClick={download} disabled={loading || !!error}><Download size={17} /> 导出记录</button>
      </div>
      {loading ? <div className="loading-panel"><span className="loading-cloud" /> 正在整理你的学习足迹…</div> :
        (tab === "attempts" ? attempts : reads).length === 0 ? <EmptyState title={tab === "attempts" ? "小小的第一步，还在等你" : "还没有收藏这片风景"} action={<Link className="button primary" href={tab === "attempts" ? "/quiz" : "/notes"}>现在去探索 <ArrowRight size={16} /></Link>}>
          {error ? "记录服务尚未同步成功，请先重试上方的同步操作。" : tab === "attempts" ? "完成一份测验后，成绩、用时和日期会出现在这里。" : "暂无历史笔记阅读记录。"}
        </EmptyState> : <div className="records-list">
          {tab === "attempts" ? attempts.slice(0, visible).map((attempt) => <article className="record-row" key={attempt.id}>
            <span className={`score-medallion ${attempt.percent >= 80 ? "high-score" : ""}`}>{attempt.percent}<small>%</small></span>
            <div className="record-row-main"><h2>{attempt.title} <span>{attempt.level}</span></h2><p><Clock3 size={13} /> {formatDate(attempt.completedAt)}<span>·</span>用时 {formatDuration(attempt.durationSeconds)}</p></div>
            <div className="record-breakdown"><strong>{attempt.correct} / {attempt.total} 正确</strong><span>{attempt.total - attempt.answered} 题留白 · 第一次选择计分</span></div>
            <Link href={`/quiz/${attempt.quizId}`} className="record-retry">再练一次 <ArrowRight size={16} /></Link>
          </article>) : reads.slice(0, visible).map((read) => <article key={read.noteId} className="record-row">
            <span className="score-medallion high-score"><Check size={23} /></span><div className="record-row-main"><h2>{read.note?.title ?? "已归档笔记"} <span>{read.note?.level}</span></h2><p>读懂于 {formatDate(read.readAt)}</p></div>
            {read.note ? <Link className="record-retry" href={`/notes/${read.noteId}`}>再读一遍 <ArrowRight size={16} /></Link> : <span className="muted">源笔记已移除</span>}
          </article>)}
        </div>}
      {(tab === "attempts" ? attempts : reads).length > visible && <button className="button secondary load-more" onClick={() => setVisible((count) => count + 20)}>再看一些足迹（已显示 {visible} 条）</button>}
    </div>
  );
}
