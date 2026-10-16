import { json, bad } from "@/lib/http";
import { getCandidateSession } from "@/lib/auth";
import { candidateFilter, candidatesCollection, findCandidate, sanitizeAnswers } from "@/lib/candidates";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await getCandidateSession();
  if (!session) return bad("Sign in with your email first.", 401);

  const exam = session.exam || "gm";
  const body = await request.json();
  const answers = sanitizeAnswers(body.answers);
  const candidates = await candidatesCollection();
  const existing = await findCandidate(session.email, exam);
  if (!existing?.startedAt) return bad("Start the examination before saving answers.");
  if (existing.submittedAt) return bad("This examination has already been submitted.");

  await candidates.updateOne(candidateFilter(existing), { $set: { answers, updatedAt: new Date() } });
  return json({ saved: true });
}
