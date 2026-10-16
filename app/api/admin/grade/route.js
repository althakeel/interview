import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { normalizeEmail } from "@/lib/candidates";
import { scoreOne } from "@/lib/autoscore";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const role = body.role || "gm";
  if (!email) return bad("Choose a candidate email.");

  try {
    const result = await scoreOne(email, { force: true, role });
    return json(result);
  } catch (error) {
    const message = error.message || "Scoring failed.";
    const status = /No answers|not started|No candidate|Choose a candidate/.test(message) ? 400 : 500;
    return bad(message, status);
  }
}
