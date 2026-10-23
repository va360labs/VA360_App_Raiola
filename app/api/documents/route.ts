import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { createDocument, isCategory, listDocuments } from "@/lib/documents";
import { documentErrorResponse, missingFileResponse, readUpload } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const category = request.nextUrl.searchParams.get("category");
  return NextResponse.json({ documents: listDocuments(isCategory(category) ? category : undefined) });
}

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  const upload = await readUpload(request);
  if (!upload) return missingFileResponse();
  try {
    return NextResponse.json({ document: await createDocument(upload) }, { status: 201 });
  } catch (error) {
    return documentErrorResponse(error);
  }
}
