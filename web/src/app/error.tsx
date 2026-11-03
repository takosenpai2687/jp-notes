"use client";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[tako-jp] Page failed", error); }, [error]);
  return <EmptyState title="遇到了一小片云" action={<button className="button primary" onClick={reset}><RefreshCw size={17} /> 再试一次</button>}>
    页面暂时没能加载。你的已保存记录不会受影响；如果持续出现，请检查终端中的错误信息。
  </EmptyState>;
}
