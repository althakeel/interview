import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import { createFileDb } from "./filedb.js";

const skipFile = path.join(process.cwd(), "data", ".atlas-skip");
const skipMs = 30 * 60 * 1000;

let resolved = null;
let connecting = null;

function atlasSkipped() {
  try {
    const until = Number(fs.readFileSync(skipFile, "utf8"));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function rememberAtlasDown() {
  try {
    fs.mkdirSync(path.dirname(skipFile), { recursive: true });
    fs.writeFileSync(skipFile, String(Date.now() + skipMs));
  } catch (error) {
    if (!["EROFS", "EACCES", "EPERM", "ENOENT"].includes(error?.code)) throw error;
  }
}

export async function getDb() {
  if (resolved) return resolved.db;
  if (!connecting) connecting = connect();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

async function connect() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "interview";
  if (uri && !atlasSkipped()) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
    try {
      await client.connect();
      const db = client.db(dbName);
      await db.command({ ping: 1 });
      resolved = { mode: "atlas", db };
      return db;
    } catch (error) {
      await client.close().catch(() => {});
      console.error("Atlas is not reachable from this computer:", error.message.split("\n")[0]);
      rememberAtlasDown();
    }
  }

  resolved = { mode: "local", db: createFileDb() };
  return resolved.db;
}

export function storageMode() {
  return resolved?.mode || "unknown";
}
