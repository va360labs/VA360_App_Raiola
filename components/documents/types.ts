import { CATEGORIES, MAX_DOCUMENT_BYTES, type Category, type DocumentStatus } from "@/lib/documents/categories";

export interface DocumentRow {
  id: number;
  name: string;
  category: Category;
  status: DocumentStatus;
  size: number;
  version: number;
  updatedLabel: string;
  sizeLabel: string;
}

export const CATEGORY_OPTIONS = (Object.keys(CATEGORIES) as Category[]).map((value) => ({
  value,
  label: CATEGORIES[value],
}));

export const MAX_UPLOAD_BYTES = MAX_DOCUMENT_BYTES;
export { CATEGORIES };
