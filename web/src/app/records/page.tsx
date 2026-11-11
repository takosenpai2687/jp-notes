import { Records } from "@/components/records";
import { getCatalog } from "@/lib/content";
import { getVocabulary } from "@/lib/vocabulary";
import { vocabularyLevels } from "@/lib/vocabulary-models";
export const metadata = { title: "学习记录" };
export default function Page() {
  const vocabularyLabels = Object.fromEntries(vocabularyLevels.flatMap((level) =>
    getVocabulary(level).map((word) => [`${level}-${word.id}`, word.word])));
  return <Records catalog={getCatalog()} vocabularyLabels={vocabularyLabels} />;
}
