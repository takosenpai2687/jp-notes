import { Records } from "@/components/records";
import { getCatalog } from "@/lib/content";
export default function Page() {
  return <Records catalog={getCatalog()} />;
}
