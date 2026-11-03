import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/ui";
export default function NotFound() {
  return <EmptyState title="这座小岛，还没出现在地图上" action={<Link className="button primary" href="/"><ArrowLeft size={17} /> 返回空岛</Link>}>
    页面可能已移动，或航线地址有误。回首页重新选一座小岛吧。
  </EmptyState>;
}
