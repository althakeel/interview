import { getDb } from "./mongodb.js";
import { resolveRole } from "./catalog.js";
import { durationMsFor } from "./settings.js";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

export function normalizeName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function nameKey(value) {
  return normalizeName(value).toLowerCase();
}

export function isValidName(name) {
  return name.length >= 2 && name.length <= 80 && /\p{L}/u.test(name);
}

export function candidateId(role, email) {
  return `${role}:${email}`;
}

let indexesReady = null;

export async function candidatesCollection() {
  const db = await getDb();
  const collection = db.collection("candidates");
  if (!indexesReady) {
    indexesReady = (async () => {
      try { await collection.dropIndex("email_1"); } catch { /* older unique email index, if present */ }
      try { await collection.dropIndex("nameKey_1"); } catch { /* older unique name index, if present */ }
      await collection.createIndex({ role: 1, email: 1 }, { unique: true });
      await collection.createIndex({ role: 1, nameKey: 1 }, { unique: true, sparse: true });
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
  return collection;
}

export async function findCandidate(email, role = "gm") {
  const candidates = await candidatesCollection();
  const rows = await candidates.find({ email }).toArray();
  return rows.find((item) => (item.role || "gm") === role) || null;
}

export function candidateFilter(candidate) {
  if (candidate?.id) return { id: candidate.id };
  return { email: candidate.email };
}

export function sanitizeAnswers(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const answers = {};
  for (const [key, value] of Object.entries(input)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id < 1 || id > 80) continue;
    answers[String(id)] = String(value || "").slice(0, 20000);
  }
  return answers;
}

export function candidateStatus(candidate) {
  if (candidate.submittedAt && candidate.scores?.finalMark !== undefined && candidate.scores?.finalMark !== null) return "Graded";
  if (candidate.submittedAt) return "Submitted";
  if (candidate.startedAt) return "In exam";
  return "Not started";
}

export async function candidateDurationMs(candidate) {
  const extra = Number(candidate?.extraMs) || 0;
  return (await durationMsFor(candidate?.role || "gm")) + (extra > 0 ? extra : 0);
}

export async function presentCandidate(candidate, minutesByRole) {
  const answers = candidate.answers || {};
  const answered = Object.values(answers).filter((value) => String(value || "").trim()).length;
  const roleId = candidate.role || "gm";
  const known = await resolveRole(roleId);
  const minutes = minutesByRole?.[roleId];
  return {
    email: candidate.email,
    name: candidate.name || "",
    role: roleId,
    roleTitle: known?.short || "Interview",
    durationMs: (minutes ? minutes * 60 * 1000 : await durationMsFor(roleId)) + Math.max(0, Number(candidate.extraMs) || 0),
    createdAt: candidate.createdAt,
    lastLoginAt: candidate.lastLoginAt,
    startedAt: candidate.startedAt,
    submittedAt: candidate.submittedAt,
    updatedAt: candidate.updatedAt,
    answered,
    status: candidateStatus(candidate),
    finalMark: candidate.scores?.finalMark ?? null,
    rating: candidate.scores?.rating ?? null,
    gradedAt: candidate.scores?.gradedAt ?? null,
    sections: (candidate.scores?.sections || []).map((section) => ({
      id: section.id,
      title: section.title,
      points: section.points,
      maxMarks: section.maxMarks,
      percent: section.percent,
    })),
  };
}
