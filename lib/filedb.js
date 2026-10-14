import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "local-db.json");
let cache = null;
let chain = Promise.resolve();

function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(cache, null, 2));
}

function matches(doc, filter) {
  return Object.entries(filter || {}).every(([key, value]) => doc?.[key] === value);
}

function applyUpdate(doc, update, inserting) {
  const next = { ...doc };
  if (inserting && update.$setOnInsert) Object.assign(next, update.$setOnInsert);
  if (update.$set) Object.assign(next, update.$set);
  return next;
}

function collection(name) {
  return {
    async createIndex() {},
    findOne(filter) {
      return enqueue(async () => {
        const data = await load();
        const found = (data[name] || []).find((doc) => matches(doc, filter));
        return found ? structuredClone(found) : null;
      });
    },
    find(filter = {}) {
      const query = {
        sort() {
          return query;
        },
        async toArray() {
          return enqueue(async () => {
            const data = await load();
            return structuredClone(data[name] || []).filter((doc) => matches(doc, filter));
          });
        },
      };
      const originalToArray = query.toArray.bind(query);
      query.sort = (spec) => {
        const [key, direction] = Object.entries(spec || {})[0] || [];
        query.toArray = () =>
          originalToArray().then((rows) => {
            if (!key) return rows;
            return rows.sort((a, b) => {
              const left = new Date(a[key] || 0).getTime();
              const right = new Date(b[key] || 0).getTime();
              return direction < 0 ? right - left : left - right;
            });
          });
        return query;
      };
      return query;
    },
    updateOne(filter, update, options = {}) {
      return enqueue(async () => {
        const data = await load();
        const rows = data[name] || [];
        const index = rows.findIndex((doc) => matches(doc, filter));
        if (index >= 0) {
          rows[index] = applyUpdate(rows[index], update, false);
        } else if (options.upsert) {
          const seed = {};
          for (const [key, value] of Object.entries(filter)) {
            if (value !== null && typeof value !== "object") seed[key] = value;
          }
          rows.push(applyUpdate(seed, update, true));
        }
        data[name] = rows;
        cache = data;
        await persist();
        return { matchedCount: index >= 0 ? 1 : 0 };
      });
    },
    replaceOne(filter, replacement, options = {}) {
      return enqueue(async () => {
        const data = await load();
        const rows = data[name] || [];
        const index = rows.findIndex((doc) => matches(doc, filter));
        if (index >= 0) rows[index] = replacement;
        else if (options.upsert) rows.push(replacement);
        data[name] = rows;
        cache = data;
        await persist();
        return { matchedCount: index >= 0 ? 1 : 0 };
      });
    },
  };
}

export function createFileDb() {
  return {
    collection(name) {
      return collection(name);
    },
  };
}
