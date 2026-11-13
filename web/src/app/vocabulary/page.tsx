import { notFound } from "next/navigation";
import { Vocabulary } from "@/components/vocabulary";
import { isLevel } from "@/lib/models";

export default async function Page({ searchParams }: { searchParams: Promise<{ level?: string | string[]; word?: string | string[] }> }) {
  const { level = "N5", word: wordId } = await searchParams;
  if (typeof level !== "string" || !isLevel(level) || (wordId !== undefined && (typeof wordId !== "string" || !wordId))) notFound();
  return <Vocabulary level={level}
    initialWordId={typeof wordId === "string" ? wordId : undefined} explicitSelection={wordId !== undefined} />;
}
