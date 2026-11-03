import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";
import { currentUser } from "@/lib/server";
import { loadProgress } from "@/lib/database";
import { emptyProgress } from "@/lib/models";
import "@fontsource-variable/nunito";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "tako-jp · 日语学习的小小世界", template: "%s · tako-jp" },
  description: "不赶路，感受日语的每一步。探索 JLPT 语法、学习笔记，收集自己的小小进步。",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const progress = user ? await loadProgress(user.id) : emptyProgress();
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body><AppProvider initialUser={user} initialProgress={progress}><Shell>{children}</Shell></AppProvider></body>
    </html>
  );
}
