import { notFound } from "next/navigation";
import { Vocabulary } from "@/components/vocabulary";
import { VocabularyDetail } from "@/components/vocabulary-detail";
import { isLevel } from "@/lib/models";
import { getVocabulary } from "@/lib/vocabulary";

export default async function Page({ searchParams }: { searchParams: Promise<{ level?: string | string[]; word?: string | string[] }> }) {
  const { level = "N5", word: wordId } = await searchParams;
  if (typeof level !== "string" || !isLevel(level) || (wordId !== undefined && typeof wordId !== "string")) notFound();
  const words = getVocabulary(level);
  const selected = wordId !== undefined ? words.find((word) => word.id === wordId) : words[0];
  if (wordId !== undefined && !selected) notFound();
  return <Vocabulary key={level} level={level} selectedId={selected?.id} explicitSelection={wordId !== undefined}
    words={words.map(({ id, word, reading, romaji, meanings }) => ({ id, word, reading, romaji, meanings }))}
    detail={selected ? <VocabularyDetail word={selected} /> : undefined} />;
}
