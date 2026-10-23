import { NextResponse } from "next/server";
import { DocumentError, type UploadInput } from "@/lib/documents";

/** Maps validation errors to 400/404 and lets anything else bubble up as a 500. */
export function documentErrorResponse(error: unknown) {
  if (error instanceof DocumentError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.code === "not_found" ? 404 : 400 },
    );
  }
  throw error;
}

/** Reads `file` (and optional `category`) from a multipart form. */
export async function readUpload(request: Request): Promise<UploadInput | null> {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return null;
  const category = form.get("category");
  return {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    category: typeof category === "string" && category !== "" ? category : undefined,
  };
}

export function missingFileResponse() {
  return NextResponse.json({ error: "Adjunta un archivo.", code: "missing_file" }, { status: 400 });
}

export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
