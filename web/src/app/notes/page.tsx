import { LibraryPage } from "@/components/library-page";
export default function Page({ searchParams }: { searchParams: Promise<{ level?: string | string[]; note?: string | string[] }> }) {
  return <LibraryPage section="notes" searchParams={searchParams} />;
}
