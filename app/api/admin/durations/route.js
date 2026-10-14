import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { getExamMinutes, saveExamMinutes } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);
  return json({ minutes: await getExamMinutes() });
}

export async function POST(request) {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);
  const body = await request.json().catch(() => ({}));
  try {
    const minutes = await saveExamMinutes(body.minutes || {});
    return json({ minutes });
  } catch (error) {
    return bad(error.message);
  }
}
