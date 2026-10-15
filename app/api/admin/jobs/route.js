import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { saveQuestionBank } from "@/lib/bank";
import { extractQuestionsWithAI } from "@/lib/grade";
import { readUploadedFile, sectionsFrom } from "@/lib/documents";
import { saveJob, updateJob } from "@/lib/jobs";
import { saveExamMinutes, parseMinutes } from "@/lib/settings";

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
      modelAnswer: String(question.modelAnswer || (question.correct ? `Correct answer: ${String(question.correct).toUpperCase()}` : "")).trim(),
    }))
    .filter((question) => question.id && question.prompt && question.modelAnswer)
    .sort((a, b) => a.id - b.id);
}

export async function POST(request) {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);

  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const short = String(form.get("short") || "").trim();
  const summary = String(form.get("summary") || "").trim();
  const minutes = parseMinutes(form.get("minutes"));
  const file = form.get("file");
  if (title.length < 3) return bad("Enter the job title.");
  if (minutes === null) return bad("Enter the exam length in whole minutes, from 5 to 240.");
  if (!file || typeof file !== "object") return bad("Upload the questions and answers.");

  try {
    const text = String(await readUploadedFile(file) || "").trim();
    if (text.length < 200) return bad("That file does not contain enough questions and answers.");
    if (text.length > 1_500_000) return bad("That file is too large.");
    const questions = text.startsWith("[")
      ? normalizeUploaded(JSON.parse(text))
      : normalizeUploaded(await extractQuestionsWithAI(text, "job"));
    if (questions.length < 5) return bad("Could not find questions and model answers in that file.");

    const job = await saveJob({ title, short: short || title, minutes, summary });
    await saveExamMinutes({ [job.id]: minutes });
    const bank = await saveQuestionBank(job.id, questions, "upload");
    await updateJob(job.id, { sections: sectionsFrom(questions) });
    return json({
      id: job.id,
      title: job.title,
      questionCount: bank.questions.length,
    });
  } catch (error) {
    return bad(error.message || "Could not add that interview.", 500);
  }
}
