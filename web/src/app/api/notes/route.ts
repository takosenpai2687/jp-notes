import { getNotesDataResponse } from "@/lib/notes-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getNotesDataResponse(request);
}
