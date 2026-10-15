"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminFrame } from "@/components/AdminFrame";
import { formatDuration, formatWhen, oneDecimal, tone } from "@/lib/format";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [times, setTimes] = useState({});
  const [savingTime, setSavingTime] = useState(false);
  const [editingTime, setEditingTime] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/overview");
    if (response.status === 401) {
      router.replace("/admin");
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not load candidates.");
      return;
    }
    setOffset(body.serverNow - Date.now());
    setData(body);
    setTimes((current) => {
      const next = { ...current };
      for (const role of body.roles || []) {
        if (next[role.id] === undefined) next[role.id] = role.minutes;
      }
      return next;
    });
  }

  useEffect(() => {
    load();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(load, 15000);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.candidates || []).filter((row) => {
      const matchesFilter = filter === "All" || bucketOf(row) === filter;
      const matchesRole = roleFilter === "All" || row.role === roleFilter;
      if (!matchesFilter || !matchesRole) return false;
      if (!needle) return true;
      return row.email.includes(needle)
        || String(row.name || "").toLowerCase().includes(needle)
        || String(row.roleTitle || "").toLowerCase().includes(needle);
    }).sort((a, b) => {
      const order = { ongoing: 0, pending: 1, done: 2 };
      const bucket = order[bucketOf(a)] - order[bucketOf(b)];
      if (bucket) return bucket;
      return activityAt(b) - activityAt(a);
    });
  }, [data, query, filter, roleFilter]);

  function remaining(row) {
    if (row.status !== "In exam" || !row.startedAt) return null;
    const end = new Date(row.startedAt).getTime() + (row.durationMs || 90 * 60 * 1000);
    return end - (now + offset);
  }

  function questionTotal(row) {
    return data?.roles?.find((role) => role.id === row.role)?.questionCount || 0;
  }

  async function saveTimes(event) {
    event.preventDefault();
    setSavingTime(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/durations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: times }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save the exam times.");
      setTimes(body.minutes || {});
      setNotice("Exam times saved. The countdown uses these minutes for both positions.");
      setEditingTime(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTime(false);
    }
  }

  async function upload(event) {
    event.preventDefault();
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: new FormData(event.target),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed");
      setNotice(`Answer key saved. ${body.questionCount} questions are ready for scoring.`);
      event.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <AdminFrame title="Candidates" note="Ongoing is in the exam now. Pending has not started or is waiting for a score. Done already has a mark. Click a number to focus the list.">
      {data?.storage === "local" ? (
        <p className="notice">
          Atlas refused the connection from this computer, so candidate papers are being saved locally.
          In MongoDB Atlas, open Network Access, add your current IP address, then restart the app.
        </p>
      ) : null}

      {!data ? <p className="studio-empty">Loading candidates…</p> : null}

      {data ? (
        <div className="studio-counts" role="tablist" aria-label="Candidate progress">
          {[
            ["ongoing", "Ongoing", "In the exam now"],
            ["pending", "Pending", "Not started, or waiting for a score"],
            ["done", "Done", "Score is ready"],
          ].map(([key, label, hint]) => (
            <button key={key} type="button" className={filter === key ? "on" : ""} onClick={() => setFilter(filter === key ? "All" : key)}>
              <b>{countFor(data.candidates, key)}</b>
              <span>{label}</span>
              <small>{hint}</small>
            </button>
          ))}
        </div>
      ) : null}

      {data?.roles?.length ? (
        editingTime ? (
          <form className="studio-time" onSubmit={saveTimes}>
            {(data?.roles || []).map((role) => (
              <label key={role.id}>
                {role.short}
                <input
                  type="number"
                  min={5}
                  max={240}
                  step={1}
                  required
                  aria-label={`${role.short} minutes`}
                  value={times[role.id] ?? role.minutes}
                  onChange={(event) => setTimes((current) => ({ ...current, [role.id]: event.target.value }))}
                />
              </label>
            ))}
            <button className="studio-btn" type="submit" disabled={savingTime}>
              {savingTime ? "Saving…" : "Save minutes"}
            </button>
            <button className="studio-quiet" type="button" onClick={() => setEditingTime(false)}>Cancel</button>
          </form>
        ) : (
          <div className="studio-time studio-time-view">
            {(data?.roles || []).map((role) => (
              <p key={role.id}>
                <span>{role.short}</span>
                <strong>{times[role.id] ?? role.minutes}</strong>
                <em>min</em>
              </p>
            ))}
            <button className="studio-btn" type="button" onClick={() => setEditingTime(true)}>Edit</button>
          </div>
        )
      ) : null}

      {data ? (
      <section className="studio-filters">
        <label className="dash-search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or email"
            aria-label="Search name or email"
          />
        </label>
        <div role="tablist" aria-label="Filter by position">
          <button type="button" className={roleFilter === "All" ? "on" : ""} onClick={() => setRoleFilter("All")}>
            All positions
          </button>
          {(data?.roles || []).map((role) => (
            <button
              key={role.id}
              type="button"
              className={roleFilter === role.id ? "on" : ""}
              onClick={() => setRoleFilter(role.id)}
            >
              {role.short}
            </button>
          ))}
        </div>
      </section>
      ) : null}

      {error ? <p className="alert">{error}</p> : null}

      {data ? <div className="ledger-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Position</th>
              <th>Status</th>
              <th>Paper</th>
              <th>Mark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const left = remaining(row);
              const total = questionTotal(row);
              const live = row.status === "In exam" || dayKey(activityAt(row)) === latestDay(data?.candidates);
              return (
                <tr key={`${row.role}-${row.email}`} className={live ? "live" : ""}>
                  <td>
                    <a href={`/admin/candidate/${encodeURIComponent(row.email)}?role=${row.role}`}>
                      <strong>{row.name || "Name not given"}</strong>
                      <small>{row.email}</small>
                    </a>
                  </td>
                  <td>{row.roleTitle}</td>
                  <td className={statusTone(row.status)}>
                    {statusLabel(row.status)}
                    <small>
                      {left !== null
                        ? `${formatDuration(left)} left`
                        : row.submittedAt
                          ? formatWhen(row.submittedAt)
                          : formatWhen(row.lastLoginAt)}
                    </small>
                  </td>
                  <td>{row.answered} / {total}</td>
                  <td className="ledger-mark">
                    {row.finalMark === null ? "—" : (
                      <strong className={tone(row.finalMark)}>{oneDecimal(row.finalMark)}</strong>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div> : null}

      {data && rows.length === 0 ? (
        <p className="studio-empty">No one matches this filter.</p>
      ) : null}

      <details className="studio-fold">
        <summary>Replace an answer key</summary>
        <form className="studio-form" onSubmit={upload}>
          <label>
            Position
            <select name="role" aria-label="Position" defaultValue="gm">
              {(data?.roles || [{ id: "gm", short: "General Manager" }, { id: "brand", short: "Brand Acquisition" }]).map((role) => (
                <option key={role.id} value={role.id}>{role.short} · {role.questionCount || "–"} questions</option>
              ))}
            </select>
          </label>
          <label>
            File
            <input name="file" type="file" accept=".txt,.md,.json,text/plain,application/json" required />
          </label>
          <button className="studio-btn" type="submit" disabled={uploading}>
            {uploading ? "Reading…" : "Upload"}
          </button>
        </form>
        {notice ? <p className="studio-note">{notice}</p> : null}
      </details>
    </AdminFrame>
  );
}

function activityAt(row) {
  return new Date(row.submittedAt || row.startedAt || row.lastLoginAt || 0).getTime();
}

function dayKey(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function latestDay(candidates) {
  const newest = (candidates || []).reduce((max, row) => Math.max(max, activityAt(row)), 0);
  return newest ? dayKey(newest) : "";
}

function bucketOf(row) {
  if (row.status === "In exam") return "ongoing";
  if (row.status === "Graded") return "done";
  return "pending";
}

function countFor(candidates, key) {
  return (candidates || []).filter((row) => bucketOf(row) === key).length;
}

function statusLabel(status) {
  if (status === "In exam") return "Ongoing";
  if (status === "Graded") return "Done";
  if (status === "Submitted") return "Pending score";
  return "Pending";
}

function statusTone(status) {
  if (status === "Graded") return "tone-high";
  if (status === "Submitted") return "tone-mid";
  if (status === "In exam") return "tone-low";
  return "tone-none";
}
