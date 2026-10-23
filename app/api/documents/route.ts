import { NextResponse, type NextRequest } from "next/server";
import { createDocument, isCategory, listDocuments } from "@/lib/documents";
import { documentErrorResponse, missingFileResponse, readUpload } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  return NextResponse.json({ documents: listDocuments(isCategory(category) ? category : undefined) });
}

export async function POST(request: NextRequest) {
  const upload = await readUpload(request);
  if (!upload) return missingFileResponse();
  try {
    return NextResponse.json({ document: await createDocument(upload) }, { status: 201 });
  } catch (error) {
    return documentErrorResponse(error);
  }
}
