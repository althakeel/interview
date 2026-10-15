import fs from "fs/promises";
import path from "path";
import { getDb } from "./mongodb.js";
import { parseExamSource } from "./parseExam.js";
import { resolveRole } from "@/lib/catalog";

const memory = new Map();

async function seedQuestions(role) {
  if (role === "brand") {
    const filePath = path.join(process.cwd(), "data", "brand-exam.json");
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  }
  if (role !== "gm") return [];
  const filePath = path.join(process.cwd(), "data", "exam-source.txt");
  const text = await fs.readFile(filePath, "utf8");
  return parseExamSource(text);
}

async function roleKey(role) {
  const known = await resolveRole(role);
  return known?.id || null;
}

export async function ensureQuestionBank(role = "gm") {
  const key = (await roleKey(role)) || "gm";
  if (memory.get(key)?.questions?.length) return memory.get(key);
  const db = await getDb();
  const collection = db.collection("questionBank");
  let existing = await collection.findOne({ _id: key });
  if (!existing && key === "gm") {
    const legacy = await collection.findOne({ _id: "bank" });
    if (legacy?.questions?.length) {
      existing = { ...legacy, _id: "gm", role: "gm" };
      await collection.replaceOne({ _id: "gm" }, existing, { upsert: true });
    }
  }
  if (existing?.questions?.length) {
    memory.set(key, existing);
    return existing;
  }
  const questions = await seedQuestions(key);
  if (!questions.length) {
    return { _id: key, role: key, questions: [], source: "empty", updatedAt: new Date() };
  }
  const doc = { _id: key, role: key, questions, source: "seed", updatedAt: new Date() };
  await db.collection("questionBank").replaceOne({ _id: key }, doc, { upsert: true });
  memory.set(key, doc);
  return doc;
}

export async function saveQuestionBank(role, questions, source) {
  const key = (await roleKey(role)) || role;
  const db = await getDb();
  const doc = { _id: key, role: key, questions, source, updatedAt: new Date() };
  await db.collection("questionBank").replaceOne({ _id: key }, doc, { upsert: true });
  memory.set(key, doc);
  return doc;
}
