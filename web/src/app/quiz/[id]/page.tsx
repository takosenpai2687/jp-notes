import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/content";
import { QuizPlayer } from "@/components/quiz-player";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const quiz = getQuiz((await params).id);
  if (!quiz) notFound();
  return { title: `${quiz.title} · ${quiz.level} 语法试炼` };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const quiz = getQuiz((await params).id);
  if (!quiz) notFound();
  return <QuizPlayer quiz={quiz} />;
}
