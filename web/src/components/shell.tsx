"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight, BookOpen, CircleHelp, Compass, Flag, Footprints,
  House, Menu, RefreshCw, Sparkle, Sprout, Sun, UserRound, WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useApp } from "./app-provider";
import { CloudFriend, Modal } from "./ui";
import { Logo } from "./logo";

const destinations = [
  { href: "/", label: "探索空岛", japanese: "ホーム", icon: Compass },
  { href: "/quiz", label: "语法试炼", japanese: "クイズ", icon: Flag },
  { href: "/notes", label: "笔记森林", japanese: "ノート", icon: BookOpen },
  { href: "/exams", label: "真题远征", japanese: "チャレンジ", icon: CircleHelp },
  { href: "/vocabulary", label: "单词花园", japanese: "ことば", icon: Sprout },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const readingNotes = pathname.startsWith("/notes");
  const { user, preferredLevel, openAuth, error, retrySync, loading } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = destinations.find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
  function navigation() {
    return (
      <>
        <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
          <Logo />
        </Link>
        <nav className="navigation" aria-label="主导航">
          {destinations.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href === "/" ? "/" : `${item.href}?level=${preferredLevel}`}
                onClick={() => setMenuOpen(false)} className={`nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}>
                {active && <motion.span layoutId="nav-indicator" className="nav-indicator" transition={{ type: "spring", stiffness: 350, damping: 32 }} />}
                <item.icon size={20} strokeWidth={1.8} /><span>{item.label}</span>
                {item.href === "/exams" || item.href === "/vocabulary" ? <span className="nav-soon">SOON</span> : null}
              </Link>
            );
          })}
          <div className="nav-divider" />
          <Link href="/records" className={`nav-link ${pathname.startsWith("/records") ? "active" : ""}`}
            onClick={() => setMenuOpen(false)} aria-current={pathname.startsWith("/records") ? "page" : undefined}>
            <Footprints size={20} strokeWidth={1.8} /><span>学习足迹</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-postcard" aria-hidden="true"><CloudFriend /></div>
          <button className="sidebar-user" onClick={() => { setMenuOpen(false); openAuth(); }}>
            <span className="avatar">{user ? user.username.slice(0, 1).toUpperCase() : <UserRound size={20} />}</span>
            <span><strong>{user?.username ?? "自由的旅行者"}</strong><small>{user ? "查看学习护照" : "游客模式 · 本机保存"}</small></span>
            <ArrowUpRight size={17} />
          </button>
        </div>
      </>
    );
  }
  return (
    <div className={`app-shell${readingNotes ? " notes-shell" : ""}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">{navigation()}</aside>
      <div className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="打开导航" onClick={() => setMenuOpen(true)}><Menu size={23} /></button>
          <Link href="/" className="mobile-brand" aria-label="tako-jp 首页"><Logo /></Link>
          <nav className="breadcrumb" aria-label="面包屑">
            <Link href="/" aria-label="返回主页"><House size={16} /><span>主页</span></Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{current?.label ?? "学习足迹"}</span>
          </nav>
          <div className="topbar-right">
            {!readingNotes && <><span className="weather"><Sun size={17} /> 今天也是学习的好天气</span>
              <span className="topbar-divider" /></>}
            <button className="account-button" onClick={openAuth}>
              <span className="tiny-avatar">{user ? user.username.slice(0, 1).toUpperCase() : <UserRound size={15} />}</span>
              <span>{user?.username ?? "登录 / 注册"}</span><ArrowUpRight size={15} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {error && <div className="sync-warning" role="alert"><WifiOff size={18} /><span>{error}</span>
            <button disabled={loading} onClick={() => void retrySync()}><RefreshCw size={15} className={loading ? "spin" : ""} /> 重试同步</button></div>}
          {children}
        </main>
        {!readingNotes && <footer className="app-footer"><span>tako-jp</span><span>不赶路，感受日语的每一步。<span className="footer-japanese"> 今日も、少しずつ。</span></span><span>Made for your own pace <Sparkle className="footer-star" size={12} /></span></footer>}
      </div>
      <Modal open={menuOpen} onOpenChange={setMenuOpen} title="探索空岛" className="navigation-modal">
        {navigation()}
      </Modal>
    </div>
  );
}
