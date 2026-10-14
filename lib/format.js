export function formatDuration(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatWhen(value) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function tone(percent) {
  if (percent === null || percent === undefined) return "tone-none";
  if (percent >= 80) return "tone-high";
  if (percent >= 60) return "tone-mid";
  return "tone-low";
}

export function oneDecimal(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return (Math.round(Number(value) * 10) / 10).toFixed(1);
}

export function answerText(answers, id) {
  if (!answers) return "";
  return answers[id] ?? answers[String(id)] ?? "";
}
