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
      const matchesFilter = filter === "All" || row.status === filter;
      const matchesRole = roleFilter === "All" || row.role === roleFilter;
      if (!matchesFilter || !matchesRole) return false;
      if (!needle) return true;
      return row.email.includes(needle)
        || String(row.name || "").toLowerCase().includes(needle)
        || String(row.roleTitle || "").toLowerCase().includes(needle);
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
    <AdminFrame title="Candidates">
      {data?.storage === "local" ? (
        <p className="notice">
          Atlas refused the connection from this computer, so candidate papers are being saved locally.
          In MongoDB Atlas, open Network Access, add your current IP address, then restart the app.
        </p>
      ) : null}

      {data ? (
        <section className="dash-stats">
          <Stat value={data.counts.loggedIn} label="Registered" hint="Name and email entered" />
          <Stat value={data.counts.inExam} label="In the exam" hint="Clock still running" />
          <Stat value={data.counts.submitted} label="Submitted" hint="Paper received" />
          <Stat value={data.counts.graded} label="Scored" hint="OpenAI mark ready" />
        </section>
      ) : null}

      <section className="time-panel">
        <div>
          <h2>Exam time</h2>
          <p className="sub">Choose the countdown for each position. A change updates anyone still in that exam.</p>
        </div>
        <form className="time-form" onSubmit={saveTimes}>
          {(data?.roles || []).map((role) => (
            <label key={role.id}>
              <span>{role.short}</span>
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
              <em>minutes</em>
            </label>
          ))}
          <button className="primary" type="submit" disabled={savingTime || !data}>
            {savingTime ? "Saving…" : "Save times"}
          </button>
        </form>
      </section>

      <section className="dash-toolbar">
        <label className="dash-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="M16 16l4 4" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            aria-label="Search name or email"
          />
        </label>
        <div className="chips" role="tablist" aria-label="Filter by position">
          <button type="button" className={roleFilter === "All" ? "chip on" : "chip"} onClick={() => setRoleFilter("All")}>
            All positions
          </button>
          {(data?.roles || []).map((role) => (
            <button
              key={role.id}
              type="button"
              className={roleFilter === role.id ? "chip on" : "chip"}
              onClick={() => setRoleFilter(role.id)}
            >
              {role.short}
            </button>
          ))}
        </div>
        <div className="chips" role="tablist" aria-label="Filter candidates">
          {["All", "Not started", "In exam", "Submitted", "Graded"].map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "chip on" : "chip"}
              onClick={() => setFilter(item)}
            >
              {item === "Graded" ? "Scored" : item}
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="alert">{error}</p> : null}

      <section className="people-grid">
        {rows.map((row) => {
          const left = remaining(row);
          const total = questionTotal(row);
          return (
            <a key={`${row.role}-${row.email}`} className="person-card" href={`/admin/candidate/${encodeURIComponent(row.email)}?role=${row.role}`}>
              <div className="person-top">
                <span className="avatar">{initials(row.name, row.email)}</span>
                <span className={`pill ${statusTone(row.status)}`}>{row.status === "Graded" ? "Scored" : row.status}</span>
              </div>
              <p className="person-role">{row.roleTitle}</p>
              <h2>{row.name || "Name not given"}</h2>
              <p className="person-email">{row.email}</p>
              <p className="person-meta">
                {left !== null
                  ? `${formatDuration(left)} left`
                  : row.submittedAt
                    ? `Submitted ${formatWhen(row.submittedAt)}`
                    : `Registered ${formatWhen(row.lastLoginAt)}`}
              </p>
              <div className="person-foot">
                <span>{row.answered} of {total} answered</span>
                <strong className={row.finalMark === null ? "" : tone(row.finalMark)}>
                  {row.finalMark === null ? "No mark yet" : `${oneDecimal(row.finalMark)}%`}
                </strong>
              </div>
              <div className="progress-track ink" aria-hidden="true">
                <i style={{ width: `${total ? Math.min(100, (row.answered / total) * 100) : 0}%` }} />
              </div>
            </a>
          );
        })}
      </section>

      {data && rows.length === 0 ? (
        <section className="panel">
          <h2>No candidates in this view</h2>
          <p className="sub">Try another filter, or wait for someone to sign in with their name and email.</p>
        </section>
      ) : null}

      <details className="key-drawer">
        <summary>Answer keys</summary>
        <p className="sub">Upload a text or JSON answer key for one position. It replaces only that position.</p>
        <form onSubmit={upload}>
          <select name="role" aria-label="Position" defaultValue="gm">
            {(data?.roles || [{ id: "gm", short: "General Manager" }, { id: "brand", short: "Brand Acquisition" }]).map((role) => (
              <option key={role.id} value={role.id}>{role.short} · {role.questionCount || "–"} questions</option>
            ))}
          </select>
          <input name="file" type="file" accept=".txt,.md,.json,text/plain,application/json" required />
          <button className="primary" type="submit" disabled={uploading}>
            {uploading ? "Reading the file…" : "Upload answer key"}
          </button>
        </form>
        {notice ? <p>{notice}</p> : null}
      </details>
    </AdminFrame>
  );
}

function Stat({ value, label, hint }) {
  return (
    <article className="dash-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{hint}</small>
    </article>
  );
}

function initials(name, email) {
  const source = String(name || email || "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]).join("").toUpperCase() || "?";
}

function statusTone(status) {
  if (status === "Graded") return "tone-high";
  if (status === "Submitted") return "tone-mid";
  if (status === "In exam") return "tone-low";
  return "tone-none";
}
