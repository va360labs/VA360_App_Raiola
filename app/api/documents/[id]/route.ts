import { NextResponse, type NextRequest } from "next/server";
import { deleteDocument, getDocument, replaceDocument } from "@/lib/documents";
import { documentErrorResponse, missingFileResponse, parseId, readUpload } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "El documento no existe.", code: "not_found" }, { status: 404 });

export async function GET(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  const document = id ? getDocument(id) : null;
  return document ? NextResponse.json({ document }) : notFound();
}

/** Uploads a new version of the document. */
export async function PUT(request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  const upload = await readUpload(request);
  if (!upload) return missingFileResponse();
  try {
    return NextResponse.json({ document: await replaceDocument(id, upload) });
  } catch (error) {
    return documentErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return notFound();
  try {
    deleteDocument(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return documentErrorResponse(error);
  }
}
