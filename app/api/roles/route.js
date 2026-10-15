import { json } from "@/lib/http";
import { listAllRoles } from "@/lib/catalog";
import { getExamMinutes } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [roles, minutes] = await Promise.all([listAllRoles(), getExamMinutes()]);
  return json({
    roles: roles.map((role) => ({
      id: role.id,
      title: role.title,
      short: role.short,
      summary: role.summary,
      minutes: minutes[role.id] || role.minutes,
      sections: role.sections || [],
    })),
  });
}
