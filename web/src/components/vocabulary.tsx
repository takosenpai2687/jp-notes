"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ArrowLeft, ArrowRight, Search, Shuffle, X } from "lucide-react";
import { useApp } from "./app-provider";
import { Arrival, EmptyState, PageIntro } from "./ui";
import { KanaDirectory } from "./kana-directory";
import { ContentTransition } from "./content-transition";
import { VocabularyDetail } from "./vocabulary-detail";
import { isLevel, levels } from "@/lib/models";
import { initialKana, kanaGroup, kanaGroups, kanaRows, normalizeKana } from "@/lib/vocabulary-models";
import { vocabularyLevels, vocabularySchema } from "@/lib/vocabulary-models";
import type { VocabularyLevel, VocabularyWord } from "@/lib/vocabulary-models";
import { z } from "zod";

type VocabularyDataset = Record<VocabularyLevel, VocabularyWord[]>;
const datasetRequests = new Map<string, Promise<VocabularyDataset>>();

function getVocabularyDataset(version: string) {
  const cached = datasetRequests.get(version);
  if (cached) return cached;
  const request = fetch(`/api/vocabulary?v=${encodeURIComponent(version)}`, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error("词库暂时无法加载，请检查网络后重试。");
      const payload = await response.json() as Record<string, unknown>;
      if (Object.keys(payload).length !== vocabularyLevels.length) throw new Error("词库数据格式不正确。");
      const dataset = {} as VocabularyDataset;
      for (const level of vocabularyLevels) {
        const words = z.array(vocabularySchema).parse(payload[level]);
        if (words.some((word) => word.level !== level) || new Set(words.map((word) => word.id)).size !== words.length) {
          throw new Error(`词库 ${level} 等级或 ID 异常。`);
        }
        words.sort((a, b) => kanaGroups.indexOf(kanaGroup(a.reading)) - kanaGroups.indexOf(kanaGroup(b.reading))
          || a.reading.localeCompare(b.reading, "ja") || a.id.localeCompare(b.id));
        dataset[level] = words;
      }
      return dataset;
    })
    .catch((error: unknown) => {
      datasetRequests.delete(version);
      throw error;
    });
  datasetRequests.set(version, request);
  return request;
}

function handleNavigation(event: MouseEvent<HTMLAnchorElement>, href: string, update: () => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  window.history.pushState(null, "", href);
  update();
}

export function Vocabulary({ level: initialLevel, dataVersion, initialWordId, explicitSelection: initialExplicitSelection }: {
  level: VocabularyLevel; dataVersion: string; initialWordId?: string; explicitSelection: boolean;
}) {
  const { setPreferredLevel } = useApp();
  const [level, setLevel] = useState(initialLevel);
  const [datasets, setDatasets] = useState<VocabularyDataset>();
  const [loadError, setLoadError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState(initialWordId);
  const [explicitSelection, setExplicitSelection] = useState(initialExplicitSelection);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("あ");
  const [page, setPage] = useState(1);
  const initializedSelection = useRef(false);
  const words = useMemo(() => datasets?.[level] ?? [], [datasets, level]);
  const selected = words.find((word) => word.id === selectedId) ?? (!explicitSelection ? words[0] : undefined);

  useEffect(() => { setPreferredLevel(level); }, [level, setPreferredLevel]);

  useEffect(() => {
    let active = true;
    void getVocabularyDataset(dataVersion).then((dataset) => {
      if (active) {
        setDatasets(dataset);
        const initial = initialWordId ? dataset[initialLevel].find((word) => word.id === initialWordId) : undefined;
        if (initial && !initializedSelection.current) {
          setGroup(initialKana(initial.reading));
          initializedSelection.current = true;
        }
      }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "词库加载失败，请稍后重试。");
    });
    return () => { active = false; };
  }, [dataVersion, initialLevel, initialWordId, loadAttempt]);

  useEffect(() => {
    function restoreLocation() {
      const params = new URLSearchParams(window.location.search);
      const nextLevel = params.get("level");
      if (!nextLevel || !isLevel(nextLevel)) return;
      const nextWordId = params.get("word") ?? undefined;
      setLevel(nextLevel);
      setSelectedId(nextWordId);
      setExplicitSelection(nextWordId !== undefined);
      setGroup(nextWordId ? initialKana(datasets?.[nextLevel]?.find((word) => word.id === nextWordId)?.reading ?? "あ") : "あ");
      setQuery("");
      setPage(1);
    }
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, [datasets]);

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
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  if (datasets && explicitSelection && !selected) notFound();

  return <div className={`library-page library-vocabulary vocabulary-page${explicitSelection ? " vocab-selected" : ""}`}>
    <Arrival className="library-heading"><PageIntro eyebrow="ことばの種を、まこう。" title="单词花园"
      description="读一个词，再认识一点世界。" aside={datasets ? <Link className="button primary" href={`/vocabulary/practice?level=${level}`}><Shuffle size={17} /> 随机抽背 · 10 词</Link> : undefined} /></Arrival>
    <nav className="level-tabs" aria-label="选择 JLPT 难度">{levels.map((item, index) =>
      <Link key={item} prefetch={false} href={`/vocabulary?level=${item}`} onClick={(event) => handleNavigation(event, `/vocabulary?level=${item}`, () => {
        setLevel(item);
        setSelectedId(undefined);
        setExplicitSelection(false);
        setGroup("あ");
        setQuery("");
        setPage(1);
      })} className={`level-tab ${level === item ? "selected" : ""}`} aria-current={level === item ? "page" : undefined}>
        <strong>{item}</strong><span>{["入门", "基础", "进阶", "熟练", "精通"][index]}</span>
      </Link>)}</nav>
    {loadError ? <EmptyState title="词库暂时没有载入" action={<button className="button primary" onClick={() => { setLoadError(undefined); setLoadAttempt((attempt) => attempt + 1); }}>重新加载</button>}>{loadError}</EmptyState>
      : !datasets ? <div className="vocab-loading" role="status" aria-busy="true"><span />正在一次载入 N5–N1 单词…</div>
      : <div className="vocab-workspace">
        <section className="vocab-list-pane" aria-label="单词列表">
          <label className="search-field"><Search size={17} /><input aria-label="搜索单词" placeholder="单词、读音或英文" value={query} onChange={(event) => { setQuery(event.target.value); setGroup("all"); setPage(1); }} />
            {query && <button aria-label="清空搜索" onClick={() => { setQuery(""); setPage(1); }}><X size={15} /></button>}</label>
          <KanaDirectory selected={group} counts={groups} onSelect={(kana) => { setGroup(kana); setQuery(""); setPage(1); }} />
          <p className="vocab-list-count" role="status">{filtered.length} / {words.length} 词</p>
          <div className="vocab-list" key={`${level}-${group}-${query}-${page}`}>
            {filtered.slice((page - 1) * 20, page * 20).map((word, index) => {
              const href = `/vocabulary?level=${level}&word=${encodeURIComponent(word.id)}`;
              return <div key={word.id}>
                <Link prefetch={false} scroll={false} href={href} onClick={(event) => handleNavigation(event, href, () => {
                  setSelectedId(word.id);
                  setExplicitSelection(true);
                })} className={`vocab-row${word.id === selected?.id ? " selected" : ""}`}
                  aria-current={word.id === selected?.id ? "page" : undefined}>
                  <strong><small className="vocab-row-index">{(page - 1) * 20 + index + 1}</small><span lang="ja">{word.word}</span></strong><span lang="ja">{word.reading}</span></Link>
              </div>;
            })}
            {!filtered.length && <p className="vocab-no-results">没有找到单词，试试其他读音或清空筛选。</p>}
          </div>
          {!!filtered.length && <nav className="vocab-pagination" aria-label="单词列表分页">
            <button type="button" aria-label="上一页单词" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={16} /></button>
            <span aria-live="polite">{page} / {pageCount}</span>
            <button type="button" aria-label="下一页单词" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ArrowRight size={16} /></button>
          </nav>}
        </section>
        <section className="vocab-detail-pane" aria-label="单词内容">
          <Link className="back-link vocab-back" href={`/vocabulary?level=${level}`} scroll={false} onClick={(event) => handleNavigation(event, `/vocabulary?level=${level}`, () => {
            setSelectedId(undefined);
            setExplicitSelection(false);
          })}><ArrowLeft size={17} /> 返回单词列表</Link>
          {selected && <ContentTransition transitionKey={`${level}-${selected.id}`}><VocabularyDetail word={selected} /></ContentTransition>}
        </section>
      </div>}
  </div>;
}
