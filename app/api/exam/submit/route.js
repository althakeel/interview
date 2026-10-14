import { json, bad } from "@/lib/http";
import { getCandidateSession } from "@/lib/auth";
import {
  candidateFilter,
  candidatesCollection,
  findCandidate,
  presentCandidate,
  sanitizeAnswers,
} from "@/lib/candidates";
import { queueScore } from "@/lib/autoscore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await getCandidateSession();
  if (!session) return bad("Sign in with your email first.", 401);

  const exam = session.exam || "gm";
  const body = await request.json().catch(() => ({}));
  const answers = sanitizeAnswers(body.answers);
  const candidates = await candidatesCollection();
  const existing = await findCandidate(session.email, exam);
  if (!existing?.startedAt) return bad("Start the examination before submitting.");
  if (existing.submittedAt) return json({ candidate: presentCandidate(existing) });

  const now = new Date();
  await candidates.updateOne(
    candidateFilter(existing),
    { $set: { answers, submittedAt: now, updatedAt: now } }
  );
  const candidate = await findCandidate(session.email, exam);
  queueScore(session.email, exam);
  return json({ candidate: presentCandidate(candidate) });
}
