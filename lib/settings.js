import { getDb } from "./mongodb.js";
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
  for (const role of listRoles()) {
    const value = Number(stored[role.id]);
    if (Number.isInteger(value) && value >= MIN_MINUTES && value <= MAX_MINUTES) {
      minutes[role.id] = value;
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
  for (const role of listRoles()) {
    if (input[role.id] === undefined) continue;
    const minutes = parseMinutes(input[role.id]);
    if (minutes === null) {
      throw new Error(`${role.short} needs a whole number of minutes from ${MIN_MINUTES} to ${MAX_MINUTES}.`);
    }
    current[role.id] = minutes;
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
