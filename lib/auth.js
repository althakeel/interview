import crypto from "crypto";
import { cookies } from "next/headers";

const CANDIDATE_COOKIE = "exam_candidate";
const ADMIN_COOKIE = "exam_admin";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is missing");
  return value;
}

export function signSession(payload, ttlMs) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + ttlMs })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readSession(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function applyCandidateCookie(response, email, exam = "gm") {
  response.cookies.set(
    CANDIDATE_COOKIE,
    signSession({ role: "candidate", email, exam }, 7 * 24 * 60 * 60 * 1000),
    cookieOptions(7 * 24 * 60 * 60)
  );
  return response;
}

export function applyAdminCookie(response) {
  response.cookies.set(
    ADMIN_COOKIE,
    signSession({ role: "admin" }, 12 * 60 * 60 * 1000),
    cookieOptions(12 * 60 * 60)
  );
  return response;
}

export function clearCookie(response, name) {
  response.cookies.set(name, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}

export async function getCandidateSession() {
  const jar = await cookies();
  const session = readSession(jar.get(CANDIDATE_COOKIE)?.value);
  if (!session || session.role !== "candidate" || !session.email) return null;
  return session;
}

export async function getAdminSession() {
  const jar = await cookies();
  const session = readSession(jar.get(ADMIN_COOKIE)?.value);
  if (!session || session.role !== "admin") return null;
  return session;
}

export const cookiesNames = { CANDIDATE_COOKIE, ADMIN_COOKIE };
