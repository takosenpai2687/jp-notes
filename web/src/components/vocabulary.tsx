"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Search, Shuffle, X } from "lucide-react";
import { useApp } from "./app-provider";
import { Arrival, EmptyState, PageIntro } from "./ui";
import { KanaDirectory } from "./kana-directory";
import { ContentTransition } from "./content-transition";
import { levels } from "@/lib/models";
import type { Level } from "@/lib/models";
import { initialKana, kanaRows, normalizeKana } from "@/lib/vocabulary-models";
import type { VocabularySummary } from "@/lib/vocabulary-models";

export function Vocabulary({ level, words, selectedId, detail, explicitSelection }: {
  level: Level; words: VocabularySummary[]; selectedId?: string; detail?: ReactNode; explicitSelection: boolean;
}) {
  const { setPreferredLevel } = useApp();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(() => explicitSelection ? initialKana(words.find((word) => word.id === selectedId)?.reading ?? "あ") : "あ");
  const [page, setPage] = useState(1);
  useEffect(() => { setPreferredLevel(level); }, [level, setPreferredLevel]);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const word of words) {
      const initial = initialKana(word.reading);
      const key = kanaRows.some((row) => row.some((kana) => kana === initial)) ? initial : "其他";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [words]);
  const filtered = useMemo(() => {
    const search = normalizeKana(query.trim()).toLowerCase();
    return words.filter((word) => (group === "all" || (group === "其他" ? !kanaRows.some((row) => row.some((kana) => kana === initialKana(word.reading))) : initialKana(word.reading) === group))
      && (!search || normalizeKana([word.word, word.reading, word.romaji, ...word.meanings].join(" ")).toLowerCase().includes(search)));
  }, [words, group, query]);
  const unlocked = words.length > 0;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  return <div className={`library-page library-vocabulary vocabulary-page${explicitSelection ? " vocab-selected" : ""}`}>
    <Arrival className="library-heading"><PageIntro eyebrow="ことばの種を、まこう。" title="单词花园"
      description="读一个词，再认识一点世界。" aside={unlocked ? <Link className="button primary" href={`/vocabulary/practice?level=${level}`}><Shuffle size={17} /> 随机抽背 · 10 词</Link> : undefined} /></Arrival>
    <nav className="level-tabs" aria-label="选择 JLPT 难度">{levels.map((item, index) =>
      <Link key={item} href={`/vocabulary?level=${item}`} className={`level-tab ${level === item ? "selected" : ""}`} aria-current={level === item ? "page" : undefined}>
        <strong>{item}</strong><span>{["入门", "基础", "进阶", "熟练", "精通"][index]}</span>
        {index > 1 && <LockKeyhole size={12} aria-label="未解锁" />}
      </Link>)}</nav>
    {!unlocked ? <EmptyState title={`${level} 单词尚未解锁`} action={<Link className="button primary" href="/vocabulary?level=N5">先看 N5 单词 <ArrowRight size={16} /></Link>}>
      目前开放 N5 和 N4，其余等级准备好后再见。
    </EmptyState> : <div className="vocab-workspace">
      <section className="vocab-list-pane" aria-label="单词列表">
        <label className="search-field"><Search size={17} /><input aria-label="搜索单词" placeholder="单词、读音或英文" value={query} onChange={(event) => { setQuery(event.target.value); setGroup("all"); setPage(1); }} />
          {query && <button aria-label="清空搜索" onClick={() => { setQuery(""); setPage(1); }}><X size={15} /></button>}</label>
        <KanaDirectory selected={group} counts={groups} onSelect={(kana) => { setGroup(kana); setQuery(""); setPage(1); }} />
        <p className="vocab-list-count" role="status">{filtered.length} / {words.length} 词</p>
        <div className="vocab-list" key={`${group}-${query}-${page}`}>
          {filtered.slice((page - 1) * 20, page * 20).map((word, index) => <div key={word.id}>
            <Link prefetch={false} scroll={false} href={`/vocabulary?level=${level}&word=${word.id}`} className={`vocab-row${word.id === selectedId ? " selected" : ""}`}
              aria-current={word.id === selectedId ? "page" : undefined}><strong><small className="vocab-row-index">{(page - 1) * 20 + index + 1}</small><span lang="ja">{word.word}</span></strong><span lang="ja">{word.reading}</span></Link>
          </div>)}
          {!filtered.length && <p className="vocab-no-results">没有找到单词，试试其他读音或清空筛选。</p>}
        </div>
        {!!filtered.length && <nav className="vocab-pagination" aria-label="单词列表分页">
          <button type="button" aria-label="上一页单词" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={16} /></button>
          <span aria-live="polite">{page} / {pageCount}</span>
          <button type="button" aria-label="下一页单词" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ArrowRight size={16} /></button>
        </nav>}
      </section>
      <section className="vocab-detail-pane" aria-label="单词内容">
        <Link className="back-link vocab-back" href={`/vocabulary?level=${level}`} scroll={false}><ArrowLeft size={17} /> 返回单词列表</Link>
        <ContentTransition transitionKey={selectedId ?? level}>{detail}</ContentTransition>
      </section>
    </div>}
  </div>;
}
