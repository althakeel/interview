import { json, bad, databaseError } from "@/lib/http";
import { applyCandidateCookie } from "@/lib/auth";
import {
  candidateFilter,
  candidateId,
  candidatesCollection,
  isValidEmail,
  isValidName,
  nameKey,
  normalizeEmail,
  normalizeName,
  presentCandidate,
} from "@/lib/candidates";
import { ensureQuestionBank } from "@/lib/bank";
import { getRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const role = getRole(body.role)?.id;
    const email = normalizeEmail(body.email);
    const name = normalizeName(body.name);
    if (!role) return bad("Choose a position.");
    if (!isValidName(name)) return bad("Enter your full name.");
    if (!isValidEmail(email)) return bad("Enter a valid email address.");

    await ensureQuestionBank(role);
    const candidates = await candidatesCollection();
    const key = nameKey(name);
    const existing = await candidates.find({}).toArray();
    const inRole = (candidate) => (candidate.role || "gm") === role;
    const sameEmail = existing.find((candidate) => candidate.email === email && inRole(candidate));
    const sameName = existing.find(
      (candidate) => candidate.nameKey === key && candidate.email !== email && inRole(candidate)
    );

    if (sameName) {
      return bad("This name is already registered for this position. Each candidate can sign in only once.");
    }
    if (sameEmail?.nameKey && sameEmail.nameKey !== key) {
      return bad("This email is already registered for this position with a different name.");
    }

    const now = new Date();
    const id = sameEmail?.id || candidateId(role, email);
    await candidates.updateOne(
      sameEmail ? candidateFilter(sameEmail) : { id },
      {
        $set: { id, role, email, name, nameKey: key, lastLoginAt: now },
        $setOnInsert: {
          createdAt: now,
          startedAt: null,
          submittedAt: null,
          answers: {},
          scores: null,
        },
      },
      { upsert: true }
    );
    const candidate = (await candidates.find({}).toArray()).find((item) => item.id === id);
    const response = json({ candidate: presentCandidate(candidate) });
    return applyCandidateCookie(response, email, role);
  } catch (error) {
    return bad(databaseError(error), 500);
  }
}
