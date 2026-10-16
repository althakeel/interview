export const ROLES = {
  gm: {
    id: "gm",
    title: "General Manager – E-Commerce",
    short: "General Manager",
    minutes: 90,
    summary: "Leadership, marketing, marketplaces, technology, and finance. Ten written questions.",
  },
  brand: {
    id: "brand",
    title: "Brand Acquisition & Franchise Development Manager",
    short: "Brand Acquisition",
    minutes: 75,
    summary: "UAE distribution and franchise rights. Five multiple-choice questions and five written answers.",
  },
};

export function getRole(id) {
  return ROLES[id] || null;
}

export function listRoles() {
  return Object.values(ROLES);
}

export function roleIdFromPath(pathname) {
  const role = String(pathname || "").split("/").filter(Boolean)[0] || "gm";
  if (role === "admin" || role === "api") return "gm";
  return role;
}

export function durationFor(roleId) {
  return (getRole(roleId)?.minutes || 90) * 60 * 1000;
}

export function ratingForRole(mark, roleId) {
  if (roleId === "brand") {
    if (mark >= 85) return "Strong shortlist";
    if (mark >= 70) return "Interview and probe the gaps";
    return "Limited evidence for this role";
  }
  if (mark >= 90) return "Exceptional. Strong GM candidate";
  if (mark >= 80) return "Very good. Recommended for final interview";
  if (mark >= 70) return "Good. Consider, subject to experience";
  if (mark >= 60) return "Below the preferred GM standard";
  return "Not recommended for this role";
}
