import { getDb } from "./mongodb.js";

const RESERVED = new Set(["admin", "api", "exam", "done", "gm", "brand", "_next"]);
let cache = null;

export function slugify(title) {
  const base = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "job";
}

export async function listJobs() {
  if (cache) return cache.map((job) => ({ ...job }));
  const db = await getDb();
  const rows = await db.collection("jobs").find({}).toArray();
  cache = rows.map(presentJob);
  return cache.map((job) => ({ ...job }));
}

export async function saveJob(input) {
  const jobs = await listJobs();
  let id = slugify(input.title);
  if (RESERVED.has(id) || jobs.some((job) => job.id === id)) {
    let n = 2;
    while (RESERVED.has(`${id}-${n}`) || jobs.some((job) => job.id === `${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  const job = presentJob({
    _id: id,
    id,
    title: String(input.title || "").trim().slice(0, 140),
    short: String(input.short || input.title || "").trim().slice(0, 40),
    minutes: input.minutes,
    summary: String(input.summary || "").trim().slice(0, 280),
    sections: [],
    createdAt: new Date(),
  });
  const db = await getDb();
  await db.collection("jobs").replaceOne({ _id: id }, { ...job, _id: id }, { upsert: true });
  cache = null;
  return job;
}

export async function updateJob(id, patch) {
  const jobs = await listJobs();
  const current = jobs.find((job) => job.id === id);
  if (!current) return null;
  const next = presentJob({ ...current, ...patch, id, _id: id });
  const db = await getDb();
  await db.collection("jobs").replaceOne({ _id: id }, { ...next, _id: id }, { upsert: true });
  cache = null;
  return next;
}

function presentJob(job) {
  return {
    id: job.id || job._id,
    title: job.title,
    short: job.short || job.title,
    minutes: Number(job.minutes) || 60,
    summary: job.summary || "",
    sections: Array.isArray(job.sections) ? job.sections : [],
    createdAt: job.createdAt || null,
  };
}
