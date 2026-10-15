export async function readUploadedFile(file) {
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") return "";
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "");
  if (name.endsWith(".pdf") || type === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join("\n\n") : String(extracted.text || "");
    if (text.trim().length < 40) {
      throw new Error("This PDF has no selectable text. Export it as a text-based PDF and try again.");
    }
    return text;
  }
  return file.text();
}

export function sectionsFrom(questions) {
  const groups = [];
  for (const question of questions) {
    const last = groups[groups.length - 1];
    if (!last || last.id !== question.sectionId) {
      groups.push({ id: question.sectionId, title: question.sectionTitle, count: 1 });
    } else {
      last.count += 1;
    }
  }
  return groups.map((group) => ({
    id: group.id,
    title: group.title,
    count: `${group.count} questions`,
  }));
}
