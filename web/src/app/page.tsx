import { Home } from "@/components/home";
import { getCatalog } from "@/lib/content";
export const metadata = { title: "首页 · 日语学习的小小世界" };
export default function Page() {
  return <Home catalog={getCatalog()} />;
}
