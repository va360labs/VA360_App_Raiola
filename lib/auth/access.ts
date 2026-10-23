/** Paths reachable without a session: login, auth API, webhooks and the health check. */
const PUBLIC_PATHS: RegExp[] = [/^\/login\/?$/, /^\/api\/auth\//, /^\/api\/webhooks\//, /^\/api\/health\/?$/];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/** Only allow redirects back to local panel paths. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || isPublicPath(value)) {
    return "/bandeja";
  }
  return value;
}
