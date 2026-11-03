import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/content";
import { QuizPlayer } from "@/components/quiz-player";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const quiz = getQuiz((await params).id);
  if (!quiz) notFound();
  return <QuizPlayer quiz={quiz} />;
}
