import { LibraryPage } from "@/components/library-page";
export default function Page({ searchParams }: { searchParams: Promise<{ level?: string | string[] }> }) {
  return <LibraryPage section="quiz" searchParams={searchParams} />;
}
