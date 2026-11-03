"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Check, ChevronRight, Flag, Footprints, Leaf, Sparkle, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "./app-provider";
import { Arrival, ArrowCircle, CloudFriend, IslandArt } from "./ui";
import { formatDate, levelLabels, levels } from "@/lib/models";
import type { Catalog } from "@/lib/models";

const islands = [
  { kind: "notes", title: "笔记森林", subtitle: "ひとつずつ、わかる。", description: "走进语法的小森林，\n让知识变成风景。", action: "翻开笔记", tag: "NOTES", icon: BookOpen },
  { kind: "quiz", title: "语法试炼", subtitle: "ちょっと、チャレンジ。", description: "知识变成小小闯关，\n每次尝试，都算数。", action: "开始挑战", tag: "QUIZ", icon: Flag },
  { kind: "vocabulary", title: "单词花园", subtitle: "ことばの種を、まこう。", description: "种下一颗词语种子，\n长成能表达的世界。", action: "探索花园", tag: "WORDS", icon: Leaf },
  { kind: "exams", title: "真题远征", subtitle: "次の冒険、準備中。", description: "走近 JLPT 的考场，\n下段冒险，准备中。", action: "先去看看", tag: "PAST PAPERS", icon: Sparkles },
] as const;

export function Home({ catalog }: { catalog: Catalog }) {
  const { preferredLevel: level, setPreferredLevel, progress, loading, user, openAuth } = useApp();
  const quizzes = catalog.quizzes.filter((quiz) => quiz.level === level);
  const notes = catalog.notes.filter((note) => note.level === level);
  const completed = new Set(progress.attempts.filter((attempt) => attempt.level === level).map((attempt) => attempt.quizId)).size;
  const latest = progress.attempts[0];
  const nextQuiz = quizzes.find((quiz) => !progress.attempts.some((attempt) => attempt.quizId === quiz.id)) ?? quizzes[0];
  const completedReads = notes.filter((note) => progress.reads.some((read) => read.noteId === note.id)).length;
  return (
    <div className="home-page">
      <Arrival className="home-heading">
        <div>
          <p className="eyebrow"><span className="sun-dot" /> きょうも、少しずつ。</p>
          <h1>今天，想去哪座<span className="heading-sky">岛</span>？<span className="heading-spark" aria-hidden="true"><Sparkle size={30} strokeWidth={1.2} /></span></h1>
          <p className="intro-description">不用一口气学会所有。选一座喜欢的小岛，轻轻出发。</p>
        </div>
        <div className="home-cloud"><span className="cloud-note">いっしょに、行こう！</span><CloudFriend /></div>
      </Arrival>
      <Arrival className="voyage-bar" delay={.06}>
        <div className="voyage-label"><span className="route-symbol"><Flag size={19} /></span><div><strong>选择你的航线</strong><span>从这里，驶向更大的世界</span></div></div>
        <div className="level-track" aria-label="日语难度">
          {levels.map((item, index) => (
            <button key={item} onClick={() => setPreferredLevel(item)} aria-pressed={item === level}
              className={`level-stop ${item === level ? "selected" : ""}`}>
              {index > 0 && <span className="level-connector" aria-hidden="true" />}
              <span className="level-stop-dot">{item === level ? <Check size={12} /> : null}</span>
              <span>{item}</span>
              <small>{["入门", "基础", "进阶", "熟练", "精通"][index]}</small>
            </button>
          ))}
        </div>
        <div className="voyage-caption"><span>{level}</span><span>{levelLabels[level].split(" · ")[0]}</span></div>
      </Arrival>
      <div className="section-line"><h2><span className="section-spark"><Sparkle size={16} strokeWidth={1.3} /></span> 四座小岛，无限可能</h2><span>选一个，开始今天的小冒险 <ArrowRight size={14} /></span></div>
      <div className="island-grid">
        {islands.map((island, index) => {
          const live = island.kind === "quiz" || island.kind === "notes";
          const count = island.kind === "quiz" ? quizzes.length : notes.length;
          return (
            <motion.div key={island.kind} initial={{ y: 18 }} animate={{ y: 0 }}
              transition={{ duration: .55, delay: .12 + index * .07, ease: [.22, 1, .36, 1] }}
              whileHover={{ y: -7 }} whileTap={{ scale: .987 }} className={`island-card island-${island.kind}`}>
              <Link href={`/${island.kind}?level=${level}`} className="island-card-link" aria-label={`${island.title}，${level}${live ? "" : "，即将开放"}`}>
                <div className="island-copy">
                  <div className="island-card-meta"><span><island.icon size={14} /> {island.tag}</span>{!live && <span className="coming-chip">即将开放</span>}</div>
                  <h3>{island.title}</h3><p className="island-japanese">{island.subtitle}</p>
                  <p className="island-description">{island.description}</p>
                  <div className="island-action"><strong>{island.action} <ArrowRight size={16} /></strong>
                    <span>{live ? `${level} · ${count} ${island.kind === "quiz" ? "份测验" : "篇笔记"}` : "Coming soon"}</span></div>
                </div>
                <IslandArt kind={island.kind} /><ArrowCircle />
              </Link>
            </motion.div>
          );
        })}
      </div>
      <Arrival className="home-bottom-grid" delay={.36}>
        <section className="journey-card">
          <div className="card-title-row"><h2><Footprints size={18} /> 留下的小小足迹</h2><Link href="/records">全部足迹 <ChevronRight size={15} /></Link></div>
          <div className="journey-stats">
            <div><strong>{loading ? "—" : completed}<small> / {quizzes.length}</small></strong><span>{level} 测验已探索</span></div>
            <div><strong>{loading ? "—" : completedReads}<small> / {notes.length}</small></strong><span>{level} 笔记已读</span></div>
            <div><strong>{loading ? "—" : progress.attempts.length}<small> 次</small></strong><span>累计小小挑战</span></div>
          </div>
          <div className="journey-footnote"><span className="tiny-status" /> {loading ? "正在寻找你的足迹…" : latest ? `最近探索：${latest.title} · ${formatDate(latest.completedAt)}` : "第一步还没留下？今天就是很好的开始。"}</div>
        </section>
        <section className="daily-card">
          <span className="daily-kana" aria-hidden="true">一歩</span>
          <div><span className="daily-label">今日的一小步</span><h2>{nextQuiz ? `试试「${nextQuiz.title}」？` : `${level} 航线还在绘制中`}</h2>
            <p>{nextQuiz ? `${nextQuiz.count} 道小题，给自己一点专注的时间。` : "先去 N5 或 N4 的小岛逛逛吧。"}</p>
            {nextQuiz ? <Link className="text-button" href={`/quiz/${nextQuiz.id}`}>轻轻出发 <ArrowRight size={16} /></Link> :
              <button className="text-button" onClick={() => setPreferredLevel("N5")}>看看 N5 航线 <ArrowRight size={16} /></button>}
          </div>
        </section>
      </Arrival>
      {!user && <div className="guest-note"><span><CloudFriend /> 你正在自由探索，学习记录会保存在此浏览器。</span>
        <button onClick={openAuth}>领取学习护照，让足迹有个家 <ArrowUpRightSmall /></button></div>}
    </div>
  );
}
function ArrowUpRightSmall() {
  return <ArrowRight size={14} className="-rotate-45" />;
}
