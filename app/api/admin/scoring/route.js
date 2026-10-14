import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { readScoreStatus, scorePending } from "@/lib/autoscore";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);
  return json(readScoreStatus());
}

export async function POST() {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);
  const status = await scorePending();
  return json(status);
}
