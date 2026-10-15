import { json, bad } from "@/lib/http";
import { getAdminSession } from "@/lib/auth";
import { candidatesCollection, presentCandidate } from "@/lib/candidates";
import { ensureQuestionBank } from "@/lib/bank";
import { storageMode } from "@/lib/mongodb";
import { readScoreStatus } from "@/lib/autoscore";
import { listAllRoles } from "@/lib/catalog";
import { getExamMinutes } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return bad("Admin sign-in required.", 401);

  const roles = await listAllRoles();
  const minutes = await getExamMinutes();
  const [candidates, banks] = await Promise.all([
    candidatesCollection().then((collection) =>
      collection.find({}).sort({ lastLoginAt: -1 }).toArray()
    ),
    Promise.all(roles.map(async (role) => {
      const bank = await ensureQuestionBank(role.id);
      return {
        id: role.id,
        title: role.title,
        short: role.short,
        minutes: minutes[role.id] || role.minutes,
        summary: role.summary || "",
        questionCount: bank.questions.length,
        keySource: bank.source,
        keyUpdatedAt: bank.updatedAt,
      };
    })),
  ]);

  const rows = await Promise.all(candidates.map((candidate) => presentCandidate(candidate, minutes)));
  return json({
    serverNow: Date.now(),
    storage: storageMode(),
    scoring: readScoreStatus(),
    roles: banks,
    counts: {
      loggedIn: rows.length,
      inExam: rows.filter((row) => row.status === "In exam").length,
      submitted: rows.filter((row) => row.status === "Submitted" || row.status === "Graded").length,
      graded: rows.filter((row) => row.status === "Graded").length,
    },
    candidates: rows,
  });
}
