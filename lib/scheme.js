import { ratingForRole } from "./roles.js";

export const EXAM_DURATION_MS = 90 * 60 * 1000;

export const GM_PAPER = [
  { id: 5, maxPoints: 10 },
  { id: 4, maxPoints: 10 },
  { id: 2, maxPoints: 10 },
  { id: 7, maxPoints: 10 },
  { id: 12, maxPoints: 10 },
  { id: 15, maxPoints: 10 },
  { id: 19, maxPoints: 10 },
  { id: 22, maxPoints: 10 },
  { id: 28, maxPoints: 10 },
  { id: 39, maxPoints: 10 },
];

export const BRAND_PAPER = [
  { id: 5, maxPoints: 8 },
  { id: 11, maxPoints: 8 },
  { id: 15, maxPoints: 8 },
  { id: 17, maxPoints: 8 },
  { id: 19, maxPoints: 8 },
  { id: 21, maxPoints: 12 },
  { id: 22, maxPoints: 12 },
  { id: 23, maxPoints: 12 },
  { id: 24, maxPoints: 12 },
  { id: 25, maxPoints: 12 },
];

export const MARK_SCHEME = [
  {
    id: "A",
    title: "General Management & Leadership",
    maxMarks: 30,
    questionIds: [5, 4, 2],
  },
  {
    id: "B",
    title: "Marketing & Digital Advertising",
    maxMarks: 20,
    questionIds: [7, 12],
  },
  {
    id: "C",
    title: "Marketplace Management",
    maxMarks: 20,
    questionIds: [15, 19],
  },
  {
    id: "D",
    title: "IT, Systems & Technology",
    maxMarks: 10,
    questionIds: [22],
  },
  {
    id: "E",
    title: "Accounting, Finance & Profitability",
    maxMarks: 10,
    questionIds: [28],
  },
  {
    id: "G",
    title: "Business Case Study",
    maxMarks: 10,
    questionIds: [39],
  },
];

export function shapePaper(questions, paper) {
  const byId = new Map((questions || []).map((question) => [Number(question.id), question]));
  const shaped = paper.map((slot) => {
    const question = byId.get(slot.id);
    if (!question) return null;
    return { ...question, maxPoints: slot.maxPoints };
  }).filter(Boolean);
  return shaped.length === paper.length ? shaped : null;
}

export function questionWeight(id) {
  const section = MARK_SCHEME.find((item) => item.questionIds.includes(Number(id)));
  if (!section) return { maxPoints: 0, section: null };
  return {
    maxPoints: section.maxMarks / section.questionIds.length,
    section,
  };
}

export function ratingFor(mark) {
  return ratingForRole(mark, "gm");
}

export function buildScoreReport(questions, aiResults, roleId = "gm") {
  const byId = new Map((aiResults || []).map((row) => [Number(row.id), row]));
  const rows = questions.map((question) => {
    const weighted = questionWeight(question.id);
    const maxPoints = Number.isFinite(question.maxPoints) ? question.maxPoints : weighted.maxPoints;
    const ai = byId.get(Number(question.id));
    const percent = clampPercent(ai?.percent);
    return {
      id: question.id,
      percent,
      points: (percent / 100) * maxPoints,
      maxPoints,
      feedback: String(ai?.feedback || "").trim(),
      sectionId: question.sectionId || weighted.section?.id,
      sectionTitle: question.sectionTitle || weighted.section?.title,
    };
  });

  const custom = questions.some((question) => Number.isFinite(question.maxPoints));
  const sections = custom
    ? sectionsFromQuestions(rows)
    : MARK_SCHEME.map((section) => {
        const items = rows.filter((row) => section.questionIds.includes(row.id));
        const points = items.reduce((sum, row) => sum + row.points, 0);
        return {
          id: section.id,
          title: section.title,
          points,
          maxMarks: section.maxMarks,
          percent: section.maxMarks ? (points / section.maxMarks) * 100 : 0,
        };
      });

  const finalMark = sections.reduce((sum, section) => sum + section.points, 0);
  const rounded = Math.round(finalMark * 10) / 10;
  return {
    finalMark: rounded,
    rating: ratingForRole(rounded, roleId),
    sections,
    questions: rows,
  };
}

function sectionsFromQuestions(rows) {
  const sections = [];
  for (const row of rows) {
    let section = sections.find((item) => item.id === row.sectionId);
    if (!section) {
      section = { id: row.sectionId, title: row.sectionTitle, points: 0, maxMarks: 0 };
      sections.push(section);
    }
    section.points += row.points;
    section.maxMarks += row.maxPoints;
  }
  return sections.map((section) => ({
    ...section,
    percent: section.maxMarks ? (section.points / section.maxMarks) * 100 : 0,
  }));
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function publicQuestion(question) {
  const weighted = questionWeight(question.id);
  const maxPoints = Number.isFinite(question.maxPoints) ? question.maxPoints : weighted.maxPoints;
  return {
    id: question.id,
    sectionId: question.sectionId || weighted.section?.id,
    sectionTitle: question.sectionTitle || weighted.section?.title,
    prompt: question.prompt,
    context: question.context || "",
    type: question.type || "written",
    choices: question.choices || [],
    maxPoints: Math.round(maxPoints * 100) / 100,
  };
}
