import { json } from "@/lib/http";
import { listRoles } from "@/lib/roles";
import { getExamMinutes } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const minutes = await getExamMinutes();
  return json({
    roles: listRoles().map((role) => ({
      id: role.id,
      title: role.title,
      short: role.short,
      summary: role.summary,
      minutes: minutes[role.id] || role.minutes,
    })),
  });
}
