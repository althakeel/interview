import OpenAI from "openai";
import { buildScoreReport } from "./scheme.js";
import { parseExamSource } from "./parseExam.js";

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function model() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

async function completeJson(messages) {
  const response = await client().chat.completions.create({
    model: model(),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages,
  });
  const text = response.choices[0]?.message?.content || "{}";
  return JSON.parse(text);
}

function chunks(list, size) {
  const output = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

export async function gradeAnswers(questions, answers, role = "gm") {
  const scored = [];
  const written = [];

  for (const question of questions) {
    const answer = String(answers?.[question.id] || answers?.[String(question.id)] || "").trim();
    if (question.type === "choice") {
      const given = answer.toUpperCase().replace(/[^A-D]/g, "").slice(0, 1);
      const expected = String(question.correct || "").toUpperCase();
      const ok = Boolean(given) && given === expected;
      scored.push({
        id: question.id,
        percent: ok ? 100 : 0,
        feedback: ok
          ? "Correct."
          : given
            ? `Selected ${given}. The best answer is ${expected}.`
            : "No answer selected.",
      });
      continue;
    }
    written.push({
      id: question.id,
      question: question.context
        ? `${question.prompt}\n\nMaterial given to the candidate:\n${question.context}`
        : question.prompt,
      modelAnswer: String(question.modelAnswer || "").slice(0, 6000),
      candidateAnswer: answer.slice(0, 6000),
      maxPoints: question.maxPoints || 0,
    });
  }

  const batches = chunks(written, 4);
  for (let index = 0; index < batches.length; index += 3) {
    const group = batches.slice(index, index + 3);
    const parts = await Promise.all(group.map((batch) => scoreBatch(batch, role)));
    scored.push(...parts.flat());
  }

  return buildScoreReport(questions, scored, role);
}

async function scoreBatch(batch, role = "gm") {
  const system = role === "brand"
    ? "You are an examiner for a Brand Acquisition and Franchise Development Manager assessment in the UAE. Each written answer is scored out of 8 using the rubric in modelAnswer. Convert that to percent: full marks is 100, half is 50, zero is 0. Award points only for the behaviours named in the rubric. Empty or off-topic answers score 0 to 15. Return JSON only in the shape {\"results\":[{\"id\":21,\"percent\":0,\"feedback\":\"one sentence\"}]}. percent is an integer from 0 to 100."
    : "You are an examiner for a General Manager e-commerce interview. Score each candidate answer against the model answer. Award partial credit for practical, relevant points even when the wording differs. Do not require exact phrases. Empty, off-topic, or one-line answers should score between 0 and 15. Strong answers that cover the commercial logic of the model answer can score 80 to 100. Return JSON only in the shape {\"results\":[{\"id\":1,\"percent\":0,\"feedback\":\"one sentence\"}]}. percent is an integer from 0 to 100. feedback is one sentence about what was covered or missing.";
  const data = await completeJson([
    {
      role: "system",
      content: system,
    },
    {
      role: "user",
      content: JSON.stringify({ answers: batch }),
    },
  ]);

  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((row) => ({
    id: Number(row.id),
    percent: row.percent,
    feedback: row.feedback,
  }));
}

export async function extractQuestionsWithAI(text, role = "gm") {
  if (role === "gm") {
    const local = parseExamSource(text);
    if (local.length >= 20) return local;
  }

  const pieces = splitDocument(text);
  const extracted = [];

  for (const piece of pieces) {
    const data = await completeJson([
      {
        role: "system",
        content:
          "Extract interview questions and their confidential model answers. Return JSON {\"questions\":[{\"id\":1,\"sectionId\":\"A\",\"sectionTitle\":\"...\",\"type\":\"written\",\"prompt\":\"question only\",\"context\":\"figures or tables the candidate must see, otherwise empty\",\"choices\":[{\"key\":\"A\",\"text\":\"...\"}],\"correct\":\"B\",\"maxPoints\":3,\"modelAnswer\":\"full model answer or the correct option\"}]}. Use type choice only for multiple-choice questions and include every option. Never put the model answer inside prompt or context. Skip any examiner scoring guide.",
      },
      { role: "user", content: piece.slice(0, 24000) },
    ]);
    if (Array.isArray(data.questions)) extracted.push(...data.questions);
  }

  const byId = new Map();
  for (const question of extracted) {
    const id = Number(question.id);
    const correct = question.correct ? String(question.correct).trim().toUpperCase().slice(0, 1) : "";
    const modelAnswer = String(question.modelAnswer || (correct ? `Correct answer: ${correct}` : "")).trim();
    if (!id || !question.prompt || !modelAnswer) continue;
    byId.set(id, {
      id,
      sectionId: String(question.sectionId || "A").slice(0, 2),
      sectionTitle: String(question.sectionTitle || "Examination").slice(0, 120),
      type: question.type === "choice" || (Array.isArray(question.choices) && question.choices.length) ? "choice" : "written",
      choices: Array.isArray(question.choices) ? question.choices : [],
      correct,
      maxPoints: Number(question.maxPoints) || undefined,
      prompt: String(question.prompt).trim(),
      context: String(question.context || "").trim(),
      modelAnswer,
    });
  }

  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function splitDocument(text) {
  const parts = text.split(/(?=^# )/m).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const size = 12000;
    const slices = [];
    for (let index = 0; index < text.length; index += size) {
      slices.push(text.slice(index, index + size));
    }
    return slices;
  }
  const groups = [];
  let current = "";
  for (const part of parts) {
    if ((current + "\n" + part).length > 14000 && current) {
      groups.push(current);
      current = part;
    } else {
      current = current ? `${current}\n${part}` : part;
    }
  }
  if (current) groups.push(current);
  return groups;
}
