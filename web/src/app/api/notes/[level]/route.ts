import { getNotesDataResponse } from "@/lib/notes-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  return getNotesDataResponse(request, level);
}
