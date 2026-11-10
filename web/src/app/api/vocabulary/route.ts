import { getVocabularyDataResponse } from "@/lib/vocabulary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getVocabularyDataResponse(request);
}
