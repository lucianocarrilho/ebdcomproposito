import { NextRequest, NextResponse } from "next/server";

// Simple middleware for route protection (no NextAuth edge dependency)
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for session token
  const hasToken =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token");

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard") && !hasToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect API routes (except auth)
  if (pathname.startsWith("/api") && !hasToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Redirect to dashboard if logged in and on login page
  if (pathname === "/" && hasToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/api/:path*"],
};
