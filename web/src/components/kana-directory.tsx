"use client";

import { useId, useState } from "react";
import { kanaVariants } from "@/lib/vocabulary-models";

export function KanaDirectory({ selected, counts, onSelect }: {
  selected: string; counts: ReadonlyMap<string, number>; onSelect: (kana: string) => void;
}) {
  const id = useId();
  const [tab, setTab] = useState(() => Math.max(0, kanaVariants.findIndex((variant) =>
    variant.rows.some((row) => row.some((kana) => kana === selected)))));
  const variant = kanaVariants[tab];
  return <details className="kana-directory" open>
    <summary>五十音目录 <span lang="ja">{selected === "all" ? "全部" : selected}</span></summary>
    <div className="kana-variant-tabs" role="tablist" aria-label="选择音组">
      {kanaVariants.map((item, index) => <button key={item.id} type="button" role="tab"
        id={`${id}-${item.id}`} aria-controls={`${id}-panel`} aria-selected={tab === index}
        tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)}
        onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % kanaVariants.length :
            event.key === "ArrowLeft" ? (index + kanaVariants.length - 1) % kanaVariants.length :
              event.key === "Home" ? 0 : event.key === "End" ? kanaVariants.length - 1 : undefined;
          if (next === undefined) return;
          event.preventDefault();
          setTab(next);
          document.getElementById(`${id}-${kanaVariants[next].id}`)?.focus();
        }}>{item.label}</button>)}
    </div>
    <div className="kana-table-scroll" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${variant.id}`}>
      <table className="kana-table" aria-label={`${variant.label}五十音目录`} lang="ja">
        <thead><tr><td />{["あ", "い", "う", "え", "お"].map((kana) => <th key={kana} scope="col">{kana}</th>)}</tr></thead>
        <tbody>{variant.rows.map((row, index) => <tr key={index}>
          <th scope="row">{kanaVariants[0].rows[index].find(Boolean)}</th>
          {row.map((kana, column) => <td key={column}><button type="button" aria-pressed={!!kana && selected === kana}
            aria-label={kana || `${kanaVariants[0].rows[index][column] || "空位"}：无${variant.label}`}
            disabled={!kana || !counts.get(kana)} onClick={() => onSelect(kana)}>
            {kana || kanaVariants[0].rows[index][column] || "—"}</button></td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <div className="kana-directory-actions">
      <button type="button" aria-pressed={selected === "all"} onClick={() => onSelect("all")}>全部</button>
      {!!counts.get("其他") && <button type="button" aria-pressed={selected === "其他"} onClick={() => onSelect("其他")}>其他</button>}
    </div>
  </details>;
}
