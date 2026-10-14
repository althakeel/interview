import { json } from "@/lib/http";
import { clearCookie, cookiesNames, getCandidateSession } from "@/lib/auth";
import { findCandidate, presentCandidate } from "@/lib/candidates";
import { ensureQuestionBank } from "@/lib/bank";
import { publicQuestion } from "@/lib/scheme";
import { getRole } from "@/lib/roles";
import { durationMsFor } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getCandidateSession();
  const requested = new URL(request.url).searchParams.get("role");
  if (!session) return json({ candidate: null, role: requested }, 200);

  const exam = session.exam || "gm";
  if (requested && getRole(requested) && requested !== exam) {
    return json({ candidate: null, role: requested }, 200);
  }

  const candidate = await findCandidate(session.email, exam);
  if (!candidate) return json({ candidate: null, role: exam }, 200);

  const bank = await ensureQuestionBank(exam);
  const inProgress = Boolean(candidate.startedAt) && !candidate.submittedAt;
  return json({
    candidate: await presentCandidate(candidate),
    serverNow: Date.now(),
    durationMs: await durationMsFor(exam),
    questionCount: bank.questions.length,
    questions: inProgress ? bank.questions.map(publicQuestion) : [],
    answers: inProgress ? candidate.answers || {} : {},
  });
}

export async function DELETE() {
  const response = json({ ok: true });
  return clearCookie(response, cookiesNames.CANDIDATE_COOKIE);
}
