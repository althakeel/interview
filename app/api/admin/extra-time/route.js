import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { candidateFilter, candidatesCollection, findCandidate, normalizeEmail } from "@/lib/candidates";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const role = body.role || "gm";
  const minutes = Number(body.minutes);
  if (!email) return bad("Choose a candidate.");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return bad("Add between 1 and 60 minutes.");

  const candidate = await findCandidate(email, role);
  if (!candidate?.startedAt) return bad("This candidate has not started the exam.");
  if (candidate.submittedAt) return bad("This paper is already submitted.");

  const extraMs = Math.max(0, Number(candidate.extraMs) || 0) + minutes * 60 * 1000;
  const candidates = await candidatesCollection();
  await candidates.updateOne(candidateFilter(candidate), { $set: { extraMs, updatedAt: new Date() } });
  return json({ email, role, minutesAdded: minutes });
}
