import { notFound } from "next/navigation";
import { VocabularyPractice } from "@/components/vocabulary-practice";
import { getVocabulary } from "@/lib/vocabulary";
import { sampleWords } from "@/lib/vocabulary-models";
import { isLevel } from "@/lib/models";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ level?: string | string[] }> }) {
  const { level = "N5" } = await searchParams;
  if (typeof level !== "string" || !isLevel(level)) notFound();
  const words = sampleWords(getVocabulary(level)).map(({ id, word, reading, romaji, meanings }) => ({ id, word, reading, romaji, meanings }));
  return <VocabularyPractice level={level} words={words} />;
}
