import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { findCandidate, normalizeEmail, presentCandidate } from "@/lib/candidates";
import { ensureQuestionBank } from "@/lib/bank";
import { questionWeight } from "@/lib/scheme";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);

  const { email: rawEmail } = await params;
  const email = normalizeEmail(decodeURIComponent(rawEmail));
  const role = new URL(request.url).searchParams.get("role") || "gm";
  const candidate = await findCandidate(email, role);
  if (!candidate) return bad("No candidate with that email.", 404);

  const exam = candidate.role || "gm";
  const bank = await ensureQuestionBank(exam);
  const answers = candidate.answers || {};
  const scoreById = new Map((candidate.scores?.questions || []).map((row) => [Number(row.id), row]));

  const sheet = bank.questions.map((question) => {
    const score = scoreById.get(question.id);
    const maxPoints = Number.isFinite(question.maxPoints)
      ? question.maxPoints
      : questionWeight(question.id).maxPoints;
    return {
      id: question.id,
      sectionId: question.sectionId,
      sectionTitle: question.sectionTitle,
      prompt: question.prompt,
      context: question.context || "",
      type: question.type || "written",
      choices: question.choices || [],
      modelAnswer: question.modelAnswer,
      answer: answers[String(question.id)] || "",
      maxPoints: maxPoints ?? null,
      percent: score?.percent ?? null,
      points: score?.points ?? null,
      feedback: score?.feedback || "",
    };
  });

  return json({
    candidate: await presentCandidate(candidate),
    scores: candidate.scores || null,
    sheet,
  });
}
