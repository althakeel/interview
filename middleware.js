import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const parts = pathname.split("/");
  if (parts[1]?.toLowerCase() === "admin" && parts[1] !== "admin") {
    parts[1] = "admin";
    const url = request.nextUrl.clone();
    url.pathname = parts.join("/") || "/admin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
