/**
 * Checks that every price, time, date or figure in a draft also appears in the
 * text it cites. This is the deterministic guard against invented data: if a
 * number in the answer is not in the cited fragments, a person must review it.
 */

const TIME = /\b(\d{1,2})(?::|\.|h)(\d{2})\b|\b(\d{1,2})\s?(?:h|hs|horas?)\b/gi;
const DATE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
const NUMBER = /\d+(?:[.,]\d+)*/g;

function numberKey(raw: string): string {
  // "1.250,50" and "1,250.50" both mean 1250.5; "40,00" means 40.
  let value = raw;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) value = value.replace(/,/g, "");
  else value = value.replace(",", ".");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : raw;
}

interface Figure {
  /** Shown to the reviewer. */
  label: string;
  /** Any of these keys found in the cited text supports the figure. */
  keys: string[];
}

/** Figures worth checking: times, dates, and numbers with a unit or of two or more digits. */
export function extractFigures(text: string): Figure[] {
  const figures: Figure[] = [];
  const used: [number, number][] = [];
  const overlaps = (start: number, end: number) => used.some(([s, e]) => start < e && end > s);

  for (const match of text.matchAll(TIME)) {
    const hour = Number(match[1] ?? match[3]);
    const minutes = match[2] ?? "00";
    if (hour > 24 || Number(minutes) > 59) continue;
    used.push([match.index!, match.index! + match[0].length]);
    figures.push({ label: match[0], keys: [`${hour}:${minutes}`, ...(minutes === "00" ? [String(hour)] : [])] });
  }
  for (const match of text.matchAll(DATE)) {
    if (overlaps(match.index!, match.index! + match[0].length)) continue;
    used.push([match.index!, match.index! + match[0].length]);
    figures.push({ label: match[0], keys: [`${Number(match[1])}/${Number(match[2])}`] });
  }
  for (const match of text.matchAll(NUMBER)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const after = text.slice(end, end + 8);
    const hasUnit = /^\s?(€|euros?\b|%|por ciento)/i.test(after) || /€\s?$/.test(text.slice(Math.max(0, start - 2), start));
    const key = numberKey(match[0]);
    if (!hasUnit && Number(key) < 10) continue;
    figures.push({ label: `${match[0]}${hasUnit ? after.match(/^\s?(€|%)/)?.[0] ?? "" : ""}`.trim(), keys: [key] });
  }
  return figures;
}

/** Every key a figure could match against in a cited fragment, including single-digit numbers. */
export function supportKeys(text: string): Set<string> {
  const keys = new Set<string>();
  for (const figure of extractFigures(text)) figure.keys.forEach((k) => keys.add(k));
  for (const match of text.matchAll(NUMBER)) keys.add(numberKey(match[0]));
  return keys;
}

/** Figures of the draft that do not appear in any of its cited fragments. */
export function unsupportedFigures(draft: string, citedTexts: string[]): string[] {
  const supported = new Set<string>();
  for (const cited of citedTexts) supportKeys(cited).forEach((k) => supported.add(k));
  return extractFigures(draft)
    .filter((figure) => !figure.keys.some((key) => supported.has(key)))
    .map((figure) => figure.label);
}
