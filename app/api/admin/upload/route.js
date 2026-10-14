import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { saveQuestionBank } from "@/lib/bank";
import { extractQuestionsWithAI } from "@/lib/grade";
import { getRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function normalizeUploaded(questions) {
  return questions
    .map((question) => ({
      id: Number(question.id),
      sectionId: String(question.sectionId || "A").slice(0, 2),
      sectionTitle: String(question.sectionTitle || "Examination").slice(0, 120),
      prompt: String(question.prompt || "").trim(),
      context: String(question.context || "").trim(),
      type: question.type === "choice" ? "choice" : "written",
      choices: Array.isArray(question.choices) ? question.choices : [],
      correct: question.correct ? String(question.correct).trim().toUpperCase() : "",
      maxPoints: Number.isFinite(Number(question.maxPoints)) ? Number(question.maxPoints) : undefined,
      modelAnswer: String(question.modelAnswer || "").trim(),
    }))
    .filter((question) => question.id && question.prompt && question.modelAnswer)
    .sort((a, b) => a.id - b.id);
}

export async function POST(request) {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);

  const form = await request.formData();
  const role = getRole(String(form.get("role") || "gm"))?.id || "gm";
  const file = form.get("file");
  const pasted = String(form.get("text") || "");
  let text = pasted;
  if (file && typeof file === "object" && "text" in file) {
    text = await file.text();
  }
  text = String(text || "").trim();
  if (text.length < 200) return bad("Upload the question and model-answer document.");
  if (text.length > 1_500_000) return bad("That file is too large.");

  try {
    let questions;
    if (text.startsWith("[")) {
      questions = normalizeUploaded(JSON.parse(text));
    } else {
      questions = normalizeUploaded(await extractQuestionsWithAI(text, role));
    }
    if (questions.length < 5) {
      return bad("Could not find questions and model answers in that file.");
    }
    const bank = await saveQuestionBank(role, questions, "upload");
    return json({
      role,
      questionCount: bank.questions.length,
      keyUpdatedAt: bank.updatedAt,
    });
  } catch (error) {
    return bad(error.message || "Could not read that answer key.", 500);
  }
}
