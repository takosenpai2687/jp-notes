import { Home } from "@/components/home";
import { getCatalog } from "@/lib/content";
export default function Page() {
  return <Home catalog={getCatalog()} />;
}
