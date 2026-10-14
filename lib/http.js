import { NextResponse } from "next/server";

export function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function bad(message, status = 400) {
  return json({ error: message }, status);
}

export function databaseError(error) {
  const text = String(error?.message || error || "");
  if (/ENOTFOUND|timed out|ECONN|whitelist|Server selection|querySrv|MongoNetwork|SSL|tlsv1|alert number/i.test(text)) {
    return "The database could not be reached. In MongoDB Atlas, open Network Access and allow this computer.";
  }
  return text || "Something went wrong.";
}
