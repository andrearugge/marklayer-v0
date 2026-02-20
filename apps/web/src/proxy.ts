import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes that require authentication (dashboard area)
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/content",
  "/graph",
  "/settings",
];

// Routes that require admin role
const ADMIN_PREFIXES = ["/admin"];

// Auth routes: redirect away if already logged in
const AUTH_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!req.auth;

  // Auth pages → redirect to app if already authenticated
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Admin routes → require login + admin role
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      );
    }
    if (req.auth?.user.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protected dashboard routes → require login
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes (handled individually)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, public assets
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
