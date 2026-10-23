import { NextResponse, type NextRequest } from "next/server";
import { isApiPath, isPublicPath } from "@/lib/auth/access";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export const config = {
  // Node runtime: the session key lives in the data volume.
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/bandeja", request.url));
  }
  if (isPublicPath(pathname) || signedIn) {
    return NextResponse.next();
  }
  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}
