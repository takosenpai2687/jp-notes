import { getVocabularyDataResponse } from "@/lib/vocabulary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ level: string; version: string }> }) {
  const { level, version } = await params;
  return getVocabularyDataResponse(request, level, version);
}
