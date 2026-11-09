"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock3, Flag, Search, Sparkles, Trophy, X } from "lucide-react";
import { useApp } from "./app-provider";
import { Arrival, EmptyState, IslandArt, PageIntro } from "./ui";
import { formatDate, levels, quizStats } from "@/lib/models";
import type { Catalog, Level } from "@/lib/models";
import { NoteLink } from "./note-link";
import { ContentTransition } from "./content-transition";

export type Section = "quiz" | "notes" | "exams" | "vocabulary";
const headings = {
  quiz: { eyebrow: "小さな挑戦、大きな一歩。", title: "语法试炼", description: "不怕选错，也不怕慢。把每一个语法点，变成自己走过的路。" },
  notes: { eyebrow: "読むたびに、景色が変わる。", title: "笔记森林", description: "让语法不再是需要记住的规则，而是慢慢读懂的风景。" },
  exams: { eyebrow: "次の冒険、準備中。", title: "真题远征", description: "下一站，真正的 JLPT 考场。先把基础的小路走踏实。" },
  vocabulary: { eyebrow: "ことばの種を、まこう。", title: "单词花园", description: "每认识一个词，就多了一种描述世界的方式。" },
};

export function Library({ section, level, catalog, reader, selectedNoteId, detail = false }: {
  section: Section; level: Level; catalog: Catalog; reader?: ReactNode; selectedNoteId?: string; detail?: boolean;
}) {
  const { progress, loading, setPreferredLevel } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => { setPreferredLevel(level); }, [level, setPreferredLevel]);
  const heading = headings[section];
  const comingSoon = section === "exams" || section === "vocabulary";
  const entries = section === "quiz"
    ? catalog.quizzes.filter((quiz) => quiz.level === level).map((quiz) => ({ ...quiz, type: "quiz" as const }))
    : catalog.notes.filter((note) => note.level === level).map((note) => ({ ...note, type: "notes" as const }));
  const done = (id: string) => progress.attempts.some((attempt) => attempt.quizId === id);
  const filtered = entries.filter((entry) => entry.title.normalize("NFC").toLowerCase().includes(query.normalize("NFC").toLowerCase())
    && (section !== "quiz" || filter === "all" || (filter === "done" ? done(entry.id) : !done(entry.id))));
  return (
    <div className={`library-page library-${section}${detail ? " notes-detail-page" : ""}`}>
      <Arrival className="library-heading"><PageIntro {...heading} aside={<div className="page-stamp">{section === "quiz" ? <Flag size={28} /> : <BookOpen size={28} />}<span>{comingSoon ? "次の旅へ" : `${level} 航线`}</span></div>} /></Arrival>
      <div className="level-tabs" aria-label="选择 JLPT 难度">
        {levels.map((item, index) => <Link key={item} href={`/${section}?level=${item}`}
          className={`level-tab ${level === item ? "selected" : ""}`} aria-current={level === item ? "page" : undefined}>
          <strong>{item}</strong><span>{["入门", "基础", "进阶", "熟练", "精通"][index]}</span>
          {level === item && <motion.span layoutId={`level-${section}`} className="level-tab-line" />}
        </Link>)}
      </div>
      {comingSoon ? (
        <Arrival className={`coming-soon-panel coming-${section}`}>
          <div className="coming-art"><IslandArt kind={section} /><span className="coming-orbit" /></div>
          <span className="status-label"><Sparkles size={14} /> COMING SOON</span>
          <h2>{section === "exams" ? "新的远征，还在准备行囊" : "词语的种子，还在慢慢发芽"}</h2>
          <p>{section === "exams" ? `${level} 真题正在等待下载与预处理。准备好后，我们会从这里出发。` :
            `${level} 单词测验会在词汇来源确定后开放。先去笔记森林，收集一点表达的灵感吧。`}</p>
          <div className="coming-actions"><Link href={`/quiz?level=${level}`} className="button primary">先去语法试炼 <ArrowRight size={17} /></Link>
            <Link href={`/notes?level=${level}`} className="button secondary">逛逛笔记森林</Link></div>
          <span className="coming-bottom">不急，好风景值得等待。<span>楽しみは、これから。</span></span>
        </Arrival>
      ) : (
        <div className={section === "notes" ? `notes-workspace${reader ? " has-preview" : ""}` : undefined}>
          <section className={section === "notes" ? "notes-library-pane" : undefined} aria-label={section === "notes" ? "笔记列表" : undefined}>
          <div className="library-toolbar">
            {section === "quiz" && <div className="filter-pills" aria-label="按完成状态筛选">
              {[["all", "全部"], ["new", "未探索"], ["done", "已探索"]].map(([value, label]) =>
                <button key={value} onClick={() => setFilter(value)} className={filter === value ? "selected" : ""}
                  disabled={loading && value !== "all"} aria-pressed={filter === value}>{label}{value === "all" && <span>{entries.length}</span>}</button>)}
            </div>}
            <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={section === "quiz" ? "搜索想挑战的语法…" : "搜索笔记"} aria-label="搜索课程" />
              {query && <button aria-label="清空搜索" onClick={() => setQuery("")}><X size={15} /></button>}</label>
          </div>
          {!entries.length ? <EmptyState title={`${level} 的航线，还在绘制中`}
            action={<Link href={`/${section}?level=N5`} className="button primary">先从 N5 出发 <ArrowRight size={16} /></Link>}>
            目前已有 N5 和 N4 的真实学习内容，其他等级会在资料准备好后开放。
          </EmptyState> : !filtered.length ? <EmptyState title="这里暂时安安静静">
            {query ? "没有找到匹配的语法，换个关键词试试吧。" : filter === "done" ? "还没有探索过这里，从一份小挑战开始吧。" : "你已经探索完这条航线，真了不起。"}
          </EmptyState> : (
            <div className="lesson-list">
              <AnimatePresence mode="popLayout">
                {filtered.map((entry, index) => {
                  const stats = entry.type === "quiz" ? quizStats(progress.attempts, entry.id) : null;
                  const visited = !!stats?.count;
                  const identity = entry.type === "notes" ? <>
                    <span className="lesson-number">{entry.no.padStart(2, "0")}</span>
                    <div className="lesson-identity"><h3>{entry.title}</h3></div>
                  </> : <>
                    <div className="lesson-number">{visited ? <Check size={23} /> : <span>{entry.no.padStart(2, "0")}</span>}</div>
                    <div className="lesson-identity"><span className="lesson-label">第 {entry.no} 课 {visited && <span>· 已探索</span>}</span><h3>{entry.title}</h3>
                      <p><Flag size={13} /> {entry.count} 道题 <span>·</span> 即时解析</p></div>
                  </>;
                  const enterLabel = `${visited ? "再次" : "开始"}${entry.type === "quiz" ? "挑战" : "阅读"}：${entry.title}`;
                  return (
                    <motion.article key={entry.id} layout initial={{ y: 12 }} animate={{ y: 0 }}
                      exit={{ opacity: 0, scale: .98 }} transition={{ duration: .25, delay: Math.min(index, 6) * .035 }}
                      className={`lesson-card ${visited ? "visited" : ""}${entry.type === "notes" && entry.id === selectedNoteId ? " selected-note" : ""}`}>
                      {entry.type === "notes" ? <NoteLink noteId={entry.id} level={level} selected={entry.id === selectedNoteId}
                        className="lesson-main-link">{identity}</NoteLink> :
                        <Link href={`/quiz/${entry.id}`} className="lesson-main-link">{identity}</Link>}
                      {entry.type === "quiz" && <div className="lesson-record">
                        <span className="record-last"><Clock3 size={14} /> {loading ? "读取中…" : stats?.latest ? `上次 ${formatDate(stats.latest.completedAt)}` : "还没来过，等你探索"}</span>
                        <span className={`record-best ${stats?.best ? "has-score" : ""}`}><Trophy size={15} /> 最佳 <strong>{stats?.best ? `${stats.best.percent}%` : "—"}</strong></span>
                      </div>}
                      {entry.type === "quiz" &&
                        <Link href={`/quiz/${entry.id}`} className="lesson-enter" aria-label={enterLabel}>
                          <span>{visited ? "再挑战" : "开始挑战"}</span><ArrowRight size={18} /></Link>}
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
          {section !== "notes" && <p className="library-end">— 不用一次走完，一步也值得庆祝。 —</p>}
          </section>
          {reader && <section className="notes-preview" aria-label="笔记内容">
            <ContentTransition transitionKey={selectedNoteId ?? level} className="note-transition" book>{reader}</ContentTransition>
          </section>}
        </div>
      )}
    </div>
  );
}
