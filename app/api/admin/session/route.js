import { json, bad } from "@/lib/http";
import { applyAdminCookie, clearCookie, cookiesNames, getAdminSession, safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  return json({ admin: Boolean(session) });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const expectedUser = process.env.ADMIN_USERNAME || "";
  const expectedPassword = process.env.ADMIN_PASSWORD || "";
  if (!expectedUser || !expectedPassword) return bad("Admin sign-in is not configured.", 500);
  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPassword)) {
    return bad("Username or password is incorrect.", 401);
  }
  const response = json({ admin: true });
  return applyAdminCookie(response);
}

export async function DELETE() {
  const response = json({ ok: true });
  return clearCookie(response, cookiesNames.ADMIN_COOKIE);
}
