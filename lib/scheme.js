import { ratingForRole } from "./roles.js";

export const EXAM_DURATION_MS = 90 * 60 * 1000;

export const MARK_SCHEME = [
  {
    id: "A",
    title: "General Management & Leadership",
    maxMarks: 12,
    questionIds: [1, 2, 3, 4, 5],
  },
  {
    id: "B",
    title: "Marketing & Digital Advertising",
    maxMarks: 18,
    questionIds: [6, 7, 8, 9, 10, 11, 12],
  },
  {
    id: "C",
    title: "Marketplace Management",
    maxMarks: 18,
    questionIds: [13, 14, 15, 16, 17, 18, 19],
  },
  {
    id: "D",
    title: "IT, Systems & Technology",
    maxMarks: 14,
    questionIds: [20, 21, 22, 23, 24, 25],
  },
  {
    id: "E",
    title: "Accounting, Finance & Profitability",
    maxMarks: 16,
    questionIds: [26, 27, 28, 29, 30, 31, 32],
  },
  {
    id: "F",
    title: "Merchandising, Procurement & Inventory",
    maxMarks: 8,
    questionIds: [33, 34, 35, 36, 37, 38],
  },
  {
    id: "G",
    title: "Business Case Study",
    maxMarks: 10,
    questionIds: [39, 40],
  },
  {
    id: "L",
    title: "Leadership",
    maxMarks: 4,
    questionIds: [41],
  },
];

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
