"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminFrame } from "@/components/AdminFrame";
import { formatWhen, oneDecimal, tone } from "@/lib/format";

export default function ComparePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [roleFilter, setRoleFilter] = useState("gm");

  async function load() {
    const response = await fetch("/api/admin/overview");
    if (response.status === 401) {
      router.replace("/admin");
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not load the comparison.");
      return;
    }
    setData(body);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const pool = (data?.candidates || []).filter((row) => row.role === roleFilter);
  const ranked = [...pool].sort((a, b) => {
    const markA = a.finalMark === null ? -1 : a.finalMark;
    const markB = b.finalMark === null ? -1 : b.finalMark;
    return markB - markA || sectionPercent(b, "G") - sectionPercent(a, "G");
  });
  const topMark = ranked.find((row) => row.finalMark !== null)?.finalMark;
  const leaders = ranked.filter((row) => row.finalMark !== null && row.finalMark === topMark);
  const sections = leaders[0]?.sections || [];

  async function gradePending() {
    const pending = pool.filter((row) => row.submittedAt && row.finalMark === null);
    if (!pending.length) {
      setStatus("Every submitted paper already has a mark.");
      return;
    }
    setError("");
    for (const row of pending) {
      setStatus(`Scoring ${row.email}…`);
      const response = await fetch("/api/admin/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email, role: row.role }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || `Could not score ${row.email}`);
        setStatus("");
        return;
      }
    }
    setStatus("Scoring finished.");
    await load();
  }

  return (
    <AdminFrame
      title="Comparison"
      extra={(
        <button className="copper no-print" type="button" onClick={gradePending} disabled={status.startsWith("Scoring") && status.endsWith("…")}>
          {status.startsWith("Scoring") && status.endsWith("…") ? status : "Score submitted papers"}
        </button>
      )}
    >
      {error ? <p className="alert">{error}</p> : null}
      {status && !status.endsWith("…") ? <p>{status}</p> : null}
      <div className="chips" role="tablist" aria-label="Position">
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

      {leaders.length ? (
        <section className="best-card">
          <div>
            <p className="kicker">Best result</p>
            <h2>{leaders.map((row) => row.name || "Candidate").join(", ")}</h2>
            <p>{leaders.map((row) => row.email).join(", ")}</p>
            <p>
              {oneDecimal(topMark)} / 100. {leaders[0].rating}
            </p>
            <a className="ghost" href={`/admin/candidate/${encodeURIComponent(leaders[0].email)}?role=${leaders[0].role}`}>Open answer sheet</a>
          </div>
          <div>
            {sections.map((section) => (
              <div key={section.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{section.title}</span>
                  <span>{oneDecimal(section.points)} / {section.maxMarks}</span>
                </div>
                <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, section.percent))}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>No marks yet</h2>
          <p className="sub">When a candidate submits, OpenAI scores the paper automatically. This page refreshes on its own.</p>
        </section>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Final mark</th>
                <th>Rating</th>
                <th>Submitted</th>
                {(sections || []).map((section) => (
                  <th key={section.id}>{section.id}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <tr key={`${row.role}-${row.email}`} className={leaders.some((leader) => leader.email === row.email && leader.role === row.role) ? "best" : ""}>
                  <td>{row.finalMark === null ? "–" : index + 1}</td>
                  <td>
                    <a href={`/admin/candidate/${encodeURIComponent(row.email)}?role=${row.role}`}><strong>{row.name || "Not given"}</strong></a>
                    <div>{row.email}</div>
                  </td>
                  <td>
                    {row.finalMark === null ? "Not scored" : (
                      <span className={`pill ${tone(row.finalMark)}`}>{oneDecimal(row.finalMark)}%</span>
                    )}
                  </td>
                  <td>{row.rating || "Awaiting score"}</td>
                  <td>{formatWhen(row.submittedAt)}</td>
                  {sections.map((section) => {
                    const found = row.sections?.find((item) => item.id === section.id);
                    return (
                      <td key={section.id}>
                        {row.finalMark === null || !found ? "–" : oneDecimal(found.points)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminFrame>
  );
}

function sectionPercent(row, id) {
  return row.sections?.find((section) => section.id === id)?.percent || 0;
}
