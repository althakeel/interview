import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { ensureQuestionBank } from "@/lib/bank";
import { resolveRole } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);

  const roleId = new URL(request.url).searchParams.get("role") || "";
  const role = await resolveRole(roleId);
  if (!role) return bad("Choose a position.", 404);

  const bank = await ensureQuestionBank(role.id);
  return json({
    role: {
      id: role.id,
      title: role.title,
      short: role.short,
    },
    questions: (bank.questions || []).map((question) => ({
      id: question.id,
      sectionId: question.sectionId,
      sectionTitle: question.sectionTitle,
      prompt: question.prompt,
      context: question.context || "",
      type: question.type || "written",
      choices: question.choices || [],
      correct: question.correct || "",
      maxPoints: question.maxPoints ?? null,
      modelAnswer: question.modelAnswer || "",
    })),
  });
}
