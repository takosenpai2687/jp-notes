import { verbClassLabel } from "@/lib/vocabulary-models";
import type { VocabularyWord } from "@/lib/vocabulary-models";
import { SpeechButton } from "./speech-button";

const posLabels: Record<string, string> = {
  n: "名词", adv: "副词", "adj-i": "い形容词", "adj-na": "な形容词", "adj-no": "の形容词",
  vi: "自动词",
  vt: "他动词", exp: "表达", int: "感叹词", pn: "代词", conj: "接续词", pref: "前缀", suf: "后缀",
};
export function Furigana({ value }: { value: string }) {
  return value.split(/(\{[^{}|]+\|[^{}]+\})/g).map((part, index) => {
    const match = /^\{([^{}|]+)\|([^{}]+)\}$/.exec(part);
    return match ? <ruby key={index}>{match[1]}<rp>（</rp><rt>{match[2]}</rt><rp>）</rp></ruby> : part;
  });
}
export function VocabularyAttribution() {
  return <details className="vocab-attribution"><summary>词库来源与许可</summary>
    <p>词库来自 <a href="https://github.com/evanclan/OpenJLPT">OpenJLPT</a>，基于 Jonathan Waller 的 JLPT 词表、
      <a href="https://www.edrdg.org/jmdict/j_jmdict.html">JMdict / EDRDG</a> 与 <a href="https://tatoeba.org">Tatoeba</a>。
      JLPT 分级为非官方参考。词库按 <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> 共享，
      例句原文按 <a href="https://creativecommons.org/licenses/by/2.0/fr/">CC BY 2.0 FR</a> 使用。</p>
  </details>;
}
export function VocabularyDetail({ word }: { word: VocabularyWord }) {
  return <article className="vocab-detail" aria-label="单词详情">
    <header className="vocab-word-header">
      <span className="vocab-level">{word.level}</span>
      <h2 lang="ja">{word.word}</h2>
      <div className="vocab-reading-line">
        <SpeechButton key={word.id} target={{ level: word.level, wordId: word.id, kind: "reading" }} label={`${word.word}的读音`} />
        <p className="vocab-reading" lang="ja">{word.reading}</p>
      </div>
      <p className="vocab-romaji">{word.romaji}</p>
      <div className="vocab-pos">{[...new Set(word.pos.map((pos) => verbClassLabel(pos) ?? posLabels[pos] ?? pos))].map((label) => <span key={label}>{label}</span>)}</div>
    </header>
    <section className="vocab-meanings" aria-label="英文释义">
      <h3>释义</h3>
      <ul>{word.meanings.map((meaning, index) => <li key={`${index}-${meaning}`}>
        <p lang="en">{meaning}</p>
      </li>)}</ul>
    </section>
    {!!word.other_forms?.length && <p className="vocab-other"><span>其他写法</span> <span lang="ja">{word.other_forms.join(" · ")}</span></p>}
    {!!word.other_readings?.length && <p className="vocab-other"><span>其他读音</span> <span lang="ja">{word.other_readings.join(" · ")}</span></p>}
    <section className="vocab-examples"><h3>例句</h3>
      {word.examples.length ? word.examples.map((example) => <div className="vocab-example" key={example.tatoeba_id}>
        <div className="vocab-example-line">
          <SpeechButton key={`${word.id}-${example.tatoeba_id}`} target={{ level: word.level, wordId: word.id, kind: "example", exampleId: example.tatoeba_id }} label={`例句：${example.ja}`} />
          <p lang="ja"><Furigana value={example.furigana ?? example.ja} /></p>
        </div>
        <p lang="en">{example.en}</p>
        <a href={`https://tatoeba.org/sentences/show/${example.tatoeba_id}`} target="_blank" rel="noreferrer">Tatoeba #{example.tatoeba_id}</a>
      </div>) : <p className="muted">此词暂未收录例句。</p>}
    </section>
    <VocabularyAttribution />
  </article>;
}
