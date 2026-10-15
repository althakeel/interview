import { getDb } from "./mongodb.js";
import { listAllRoles } from "./catalog.js";
import { getRole, listRoles } from "./roles.js";

const MIN_MINUTES = 5;
const MAX_MINUTES = 240;

let cache = null;

function defaultMinutes() {
  const minutes = {};
  for (const role of listRoles()) minutes[role.id] = role.minutes;
  return minutes;
}

export function minuteLimits() {
  return { min: MIN_MINUTES, max: MAX_MINUTES };
}

export function parseMinutes(value) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) return null;
  return minutes;
}

export async function getExamMinutes() {
  if (cache) return { ...cache };
  const db = await getDb();
  const doc = await db.collection("settings").findOne({ _id: "examMinutes" });
  const stored = doc?.minutes || {};
  const minutes = defaultMinutes();
  for (const role of await listAllRoles()) minutes[role.id] = role.minutes;
  for (const [id, value] of Object.entries(stored)) {
    const minutesValue = Number(value);
    if (Number.isInteger(minutesValue) && minutesValue >= MIN_MINUTES && minutesValue <= MAX_MINUTES) {
      minutes[id] = minutesValue;
    }
  }
  cache = minutes;
  return { ...minutes };
}

export async function minutesFor(roleId) {
  const minutes = await getExamMinutes();
  return minutes[roleId] || getRole(roleId)?.minutes || 90;
}

export async function durationMsFor(roleId) {
  return (await minutesFor(roleId)) * 60 * 1000;
}

export async function saveExamMinutes(input) {
  const current = await getExamMinutes();
  const roles = await listAllRoles();
  const known = new Map(roles.map((role) => [role.id, role]));
  for (const [id, raw] of Object.entries(input || {})) {
    if (!known.has(id) && !/^[a-z0-9-]{1,48}$/.test(id)) continue;
    const minutes = parseMinutes(raw);
    if (minutes === null) {
      throw new Error(`${known.get(id)?.short || "Exam"} needs a whole number of minutes from ${MIN_MINUTES} to ${MAX_MINUTES}.`);
    }
    current[id] = minutes;
  }
  const db = await getDb();
  await db.collection("settings").replaceOne(
    { _id: "examMinutes" },
    { _id: "examMinutes", minutes: current, updatedAt: new Date() },
    { upsert: true }
  );
  cache = { ...current };
  return { ...current };
}
