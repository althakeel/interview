import { json, bad } from "@/lib/http";
import { getCandidateSession } from "@/lib/auth";
import { candidateFilter, candidatesCollection, findCandidate, presentCandidate } from "@/lib/candidates";
import { ensureQuestionBank } from "@/lib/bank";
import { publicQuestion } from "@/lib/scheme";
import { durationFor } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getCandidateSession();
  if (!session) return bad("Sign in with your email first.", 401);

  const exam = session.exam || "gm";
  const candidates = await candidatesCollection();
  const existing = await findCandidate(session.email, exam);
  if (!existing) return bad("Candidate record was not found.", 404);
  if (existing.submittedAt) return bad("This examination has already been submitted.");

  if (!existing.startedAt) {
    await candidates.updateOne(candidateFilter(existing), { $set: { startedAt: new Date(), role: exam } });
  }

  const candidate = await findCandidate(session.email, exam);
  const bank = await ensureQuestionBank(exam);
  return json({
    candidate: presentCandidate(candidate),
    serverNow: Date.now(),
    durationMs: durationFor(exam),
    questions: bank.questions.map(publicQuestion),
    answers: candidate.answers || {},
  });
}
