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
        <button className="studio-btn no-print" type="button" onClick={gradePending} disabled={status.startsWith("Scoring") && status.endsWith("…")}>
          {status.startsWith("Scoring") && status.endsWith("…") ? status : "Score papers"}
        </button>
      )}
    >
      {error ? <p className="alert">{error}</p> : null}
      {status && !status.endsWith("…") ? <p className="studio-note">{status}</p> : null}
      <div className="studio-filters" role="tablist" aria-label="Position">
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

      {leaders.length ? (
        <section className="studio-lead">
          <div>
            <p className="studio-kicker">Leading paper</p>
            <p className="studio-mark">{oneDecimal(topMark)}</p>
            <p>{leaders[0].rating}</p>
          </div>
          <div>
            <h2>{leaders.map((row) => row.name || "Candidate").join(", ")}</h2>
            <p>{leaders.map((row) => row.email).join(", ")}</p>
            <a href={`/admin/candidate/${encodeURIComponent(leaders[0].email)}?role=${leaders[0].role}`}>Open answer sheet</a>
          </div>
          <dl className="studio-sections">
            {sections.map((section) => (
              <div key={section.id}>
                <dt>{section.title}</dt>
                <dd>{oneDecimal(section.points)} / {section.maxMarks}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <p className="studio-empty">No marks for this position yet.</p>
      )}

      <div className="ledger-wrap">
          <table className="ledger">
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
                  <td className="ledger-mark">
                    {row.finalMark === null ? "—" : (
                      <strong className={tone(row.finalMark)}>{oneDecimal(row.finalMark)}</strong>
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
    </AdminFrame>
  );
}

function sectionPercent(row, id) {
  return row.sections?.find((section) => section.id === id)?.percent || 0;
}
