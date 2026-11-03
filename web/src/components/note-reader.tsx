import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, Flag, List } from "lucide-react";
import { getCatalog, noteOutline, noteUrl } from "@/lib/content";
import type { Note } from "@/lib/models";
import { NoteActions, NoteReadingPanel, ReadingMeter } from "./note-actions";
import { NoteLink } from "./note-link";

export function NoteReader({ note, embedded = false }: { note: Note; embedded?: boolean }) {
  const outline = noteOutline(note.markdown);
  const siblings = getCatalog().notes.filter((item) => item.level === note.level);
  const index = siblings.findIndex((item) => item.id === note.id);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];
  const toc = outline.length > 0 && <nav className="note-toc" aria-label="笔记目录"><h2><List size={17} /> 这片森林的地图</h2>
    {outline.map((heading) => <a key={heading.id} href={`#${heading.id}`} className={heading.depth === 3 ? "toc-nested" : ""}>{heading.text}</a>)}</nav>;
  const challenge = note.quizId && <div className="note-challenge"><Flag size={22} /><h2>把理解，变成自己的</h2><p>来一份同课小测，看看哪些知识已经稳稳记住。</p><Link href={`/quiz/${note.quizId}`} className="button primary full">去语法试炼 <ArrowRight size={16} /></Link></div>;
  const content = <>
      <Link href={`/notes?level=${note.level}`} className="back-link"><ArrowLeft size={17} /> 返回笔记森林 <span>/ {note.level}</span></Link>
      <div className="reader-layout">
        <div className="reader-column">
          <article className="note-paper">
            <header className="note-header"><div className="note-meta"><span><BookOpen size={14} /> {note.level} 语法笔记</span><span>第 {note.no} 课</span><span><Clock3 size={14} /> 约 {note.minutes} 分钟</span></div>
              <h1>{note.title}</h1><p>一字一句，慢慢读懂。<span>読むたびに、新しい発見。</span></p></header>
            {embedded && toc && <details className="note-inline-toc"><summary><List size={17} /> 展开这篇笔记的目录</summary>{toc}</details>}
            <div className="note-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeSlug]}
                urlTransform={(url) => defaultUrlTransform(noteUrl(note, url))}
                components={{
                  table: ({ children }) => <div className="table-scroll" tabIndex={0} role="region" aria-label="语法表格"><table>{children}</table></div>,
                  a: ({ children, href }) => href ? <a href={href} {...(/^https?:/.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a> : <span>{children}</span>,
                }}>
                {note.markdown.replace(/^#\s+[^\n]+\r?\n/, "")}
              </ReactMarkdown>
            </div>
            <div className="note-paper-footer"><span>ここまで、おつかれさま。</span><p>又读懂了一点点，很棒。</p><NoteActions noteId={note.id} /></div>
            {embedded && challenge}
          </article>
          <nav className="note-pagination" aria-label="相邻笔记">
            {previous ? <NoteLink noteId={previous.id} level={note.level}><ArrowLeft size={18} /><span><small>上一片风景</small>{previous.title}</span></NoteLink> : <span />}
            {next ? <NoteLink noteId={next.id} level={note.level}><span><small>下一片风景</small>{next.title}</span><ArrowRight size={18} /></NoteLink> : <span />}
          </nav>
        </div>
        {!embedded && <aside className="note-aside">
          {toc}
          {challenge}
          <div className="reader-tip"><span>ひとこと</span><p>不用着急记住每一句。<br />先理解，再回来看。</p></div>
        </aside>}
      </div>
  </>;
  return embedded ? <NoteReadingPanel key={note.id}>{content}</NoteReadingPanel> :
    <div className="reader-page"><ReadingMeter />{content}</div>;
}
