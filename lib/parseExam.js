const SECTION_SCHEME = {
  A: "General Management & Leadership",
  B: "Marketing & Digital Advertising",
  C: "Marketplace Management",
  D: "IT, Systems & Technology",
  E: "Accounting, Finance & Profitability",
  F: "Merchandising, Procurement & Inventory",
  G: "Business Case Study",
  L: "Leadership",
};

export function parseExamSource(text) {
  const normalized = text.replace(/\r/g, "");
  const cut = normalized.search(/^# Confidential/m);
  const body = cut >= 0 ? normalized.slice(0, cut) : normalized;
  const lines = body.split(/\n/);
  let section = { id: "A", title: SECTION_SCHEME.A };
  let current = null;
  const questions = [];

  function push() {
    if (!current) return;
    const raw = current.lines.join("\n").trim();
    let context = "";
    let modelAnswer = raw.replace(/^(Model Answer:|Ideal Answer:)\s*/i, "").trim();

    if (current.id === 39) {
      const marker = raw.search(/Model Answer:/i);
      if (marker >= 0) {
        context = raw
          .slice(0, marker)
          .replace(/^The candidate is provided with the following monthly financial figures\.\s*/i, "")
          .trim();
        modelAnswer = raw
          .slice(marker)
          .replace(/^Model Answer:\s*/i, "")
          .trim();
      }
    }

    questions.push({
      id: current.id,
      sectionId: current.sectionId,
      sectionTitle: current.sectionTitle,
      prompt: current.prompt,
      context,
      modelAnswer,
    });
    current = null;
  }

  for (const line of lines) {
    const sectionMatch = line.match(/^# Section ([A-G])\s+[—–-]\s+(.+)$/);
    if (sectionMatch) {
      section = {
        id: sectionMatch[1],
        title: SECTION_SCHEME[sectionMatch[1]] || sectionMatch[2].trim(),
      };
      continue;
    }

    if (/^# Final Interview/i.test(line)) {
      section = { id: "L", title: SECTION_SCHEME.L };
      continue;
    }

    const questionMatch = line.match(/^## (\d+)\.\s+(.+)$/);
    if (questionMatch) {
      push();
      current = {
        id: Number(questionMatch[1]),
        prompt: questionMatch[2].trim(),
        sectionId: section.id,
        sectionTitle: section.title,
        lines: [],
      };
      continue;
    }

    const leadershipMatch = line.match(/^Question:\s+(.+)$/);
    if (leadershipMatch && section.id === "L") {
      push();
      current = {
        id: 41,
        prompt: leadershipMatch[1].trim(),
        sectionId: "L",
        sectionTitle: section.title,
        lines: [],
      };
      continue;
    }

    if (current) current.lines.push(line);
  }

  push();

  const byId = new Map();
  for (const question of questions) {
    if (!question.prompt || !question.modelAnswer) continue;
    byId.set(question.id, question);
  }

  return [...byId.values()].sort((a, b) => a.id - b.id);
}
