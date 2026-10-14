import fs from "fs";
import path from "path";
import { candidateFilter, candidatesCollection, findCandidate } from "./candidates.js";
import { ensureQuestionBank } from "./bank.js";
import { gradeAnswers } from "./grade.js";
import { durationMsFor } from "./settings.js";

const statusFile = path.join(process.cwd(), "data", ".score-status.json");
const lockFile = path.join(process.cwd(), "data", ".score-lock");
const intervalMs = Number(process.env.SCORE_INTERVAL_MS || 60_000);

let started = false;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

export function readScoreStatus() {
  return {
    enabled: true,
    current: null,
    lastRun: null,
    lastScored: null,
    lastMark: null,
    lastError: null,
    ...readJson(statusFile, {}),
  };
}

function writeStatus(patch) {
  writeJson(statusFile, { ...readScoreStatus(), ...patch, enabled: true });
}

function hasAnswers(candidate) {
  return Object.values(candidate?.answers || {}).some((value) => String(value || "").trim());
}

function needsScore(candidate) {
  if (!candidate?.startedAt) return false;
  const unscored = candidate.scores == null || candidate.scores.finalMark == null;
  if (candidate.submittedAt) return unscored;
  if (!hasAnswers(candidate)) return false;
  if (unscored) return true;
  const gradedAt = new Date(candidate.scores.gradedAt || 0).getTime();
  const updatedAt = new Date(candidate.updatedAt || 0).getTime();
  return updatedAt > gradedAt + 2000;
}

async function closeExpiredExams() {
  const candidates = await candidatesCollection();
  const rows = await candidates.find({}).toArray();
  for (const candidate of rows) {
    if (!candidate.startedAt || candidate.submittedAt) continue;
    const limit = await durationMsFor(candidate.role || "gm");
    const elapsed = Date.now() - new Date(candidate.startedAt).getTime();
    if (elapsed <= limit + 5000) continue;
    await candidates.updateOne(candidateFilter(candidate), {
      $set: { submittedAt: new Date(), updatedAt: new Date() },
    });
  }
}

function tryLock() {
  const existing = readJson(lockFile, null);
  if (existing?.until > Date.now()) return false;
  writeJson(lockFile, { until: Date.now() + 5 * 60 * 1000 });
  return true;
}

function unlock() {
  fs.rmSync(lockFile, { force: true });
}

export async function scoreOne(email, { force = false, role } = {}) {
  const candidates = await candidatesCollection();
  const candidate = role
    ? await findCandidate(email, role)
    : await candidates.findOne({ email });
  if (!candidate) throw new Error("No candidate with that email.");
  if (!force && !candidate.startedAt) throw new Error("This candidate has not started the exam.");
  if (!force && !candidate.submittedAt && !hasAnswers(candidate)) {
    throw new Error("No answers have been saved yet.");
  }
  if (!force && !needsScore(candidate)) {
    return { email, finalMark: candidate.scores.finalMark, rating: candidate.scores.rating, skipped: true };
  }

  const exam = candidate.role || role || "gm";
  writeStatus({ current: email, lastError: null });
  const bank = await ensureQuestionBank(exam);
  const report = await gradeAnswers(bank.questions, candidate.answers || {}, exam);
  const scores = {
    ...report,
    gradedAt: new Date(),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
  await candidates.updateOne(candidateFilter(candidate), { $set: { scores } });
  writeStatus({
    current: null,
    lastScored: email,
    lastMark: scores.finalMark,
    lastError: null,
    lastRun: new Date().toISOString(),
  });
  return { email, finalMark: scores.finalMark, rating: scores.rating };
}

export function queueScore(email, role = "gm") {
  scoreOne(email, { role }).catch((error) => {
    writeStatus({ current: null, lastError: error.message || "Scoring failed." });
  });
}

export async function scorePending() {
  if (!tryLock()) return readScoreStatus();
  try {
    await closeExpiredExams();
    const candidates = await candidatesCollection();
    const pending = (await candidates.find({}).toArray()).filter(needsScore);
    writeStatus({ lastRun: new Date().toISOString(), pending: pending.length, lastError: null });
    for (const candidate of pending) {
      await scoreOne(candidate.email, { role: candidate.role || "gm" });
    }
    writeStatus({ current: null, pending: 0, lastRun: new Date().toISOString() });
  } catch (error) {
    writeStatus({ current: null, lastError: error.message || "Scoring failed." });
  } finally {
    unlock();
  }
  return readScoreStatus();
}

export function startAutoScorer() {
  if (started) return;
  started = true;
  console.log("Auto scoring is on. Submitted papers are checked about once a minute.");
  setTimeout(() => {
    scorePending().catch((error) => writeStatus({ lastError: error.message || "Scoring failed." }));
  }, 8000);
  setInterval(() => {
    scorePending().catch((error) => writeStatus({ lastError: error.message || "Scoring failed." }));
  }, intervalMs);
}
