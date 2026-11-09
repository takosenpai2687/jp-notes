import { BookOpen } from "lucide-react";

function SkeletonLines({ short = false }: { short?: boolean }) {
  return <div className={`note-skeleton-lines${short ? " short" : ""}`}>
    <span /><span /><span /><span />
  </div>;
}

export function NoteLoading({ detail = false, embedded = false }: { detail?: boolean; embedded?: boolean }) {
  return <div className={`note-loading${detail ? " note-loading-detail" : ""}${embedded ? " note-loading-embedded" : ""}`} role="status" aria-busy="true">
    <span className="sr-only">正在加载笔记，请稍候。</span>
    {!embedded && <div className="note-loading-heading" aria-hidden="true">
      <span className="note-skeleton-title" />
      <div className="note-skeleton-levels">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
    </div>}
    <div className="note-loading-workspace" aria-hidden="true">
      {!embedded && <aside className="note-loading-list">
        <div className="note-skeleton-search" />
        {Array.from({ length: 8 }, (_, index) => <div className="note-skeleton-lesson" key={index}>
          <span /><span />
        </div>)}
      </aside>}
      <div className="note-loading-reader">
        <div className="note-loading-paper">
          <div className="note-loading-caption"><BookOpen size={18} /><span>正在展开笔记…</span><i /></div>
          <div className="note-skeleton-article-title" />
          <div className="note-skeleton-outline"><span /><span /><span /></div>
          <div className="note-skeleton-section" />
          <SkeletonLines />
          <div className="note-skeleton-table">
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
          </div>
          <div className="note-skeleton-section" />
          <SkeletonLines short />
        </div>
      </div>
    </div>
  </div>;
}
