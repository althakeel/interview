import { listJobs } from "./jobs.js";
import { getRole, listRoles } from "./roles.js";

export async function listAllRoles() {
  const jobs = await listJobs();
  const built = new Set(listRoles().map((role) => role.id));
  return [...listRoles(), ...jobs.filter((job) => !built.has(job.id))];
}

export async function resolveRole(id) {
  if (!id) return null;
  const built = getRole(id);
  if (built) return built;
  const jobs = await listJobs();
  return jobs.find((job) => job.id === id) || null;
}
