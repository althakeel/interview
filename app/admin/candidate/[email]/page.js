"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AdminFrame } from "@/components/AdminFrame";
import { formatWhen, oneDecimal, tone } from "@/lib/format";

export default function CandidateSheetPage() {
  return (
    <Suspense fallback={<p className="center">Loading the answer sheet…</p>}>
      <CandidateSheet />
    </Suspense>
  );
}

function scoreNote(candidate, scores) {
  if (scores?.rating) return scores.rating;
  if (!candidate?.startedAt) return "This candidate has not started the exam.";
  if (!candidate.answered && !candidate.submittedAt) {
    return "No answers have been saved yet, so OpenAI has nothing to score.";
  }
  if (!candidate.submittedAt) return "OpenAI checks saved answers about once a minute.";
  return "Submitted. OpenAI is scoring this paper.";
}

function CandidateSheet() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const email = decodeURIComponent(params.email || "");
  const role = search.get("role") || "gm";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [scoring, setScoring] = useState(false);

  async function load() {
    const response = await fetch(`/api/admin/candidates/${encodeURIComponent(email)}?role=${encodeURIComponent(role)}`);
    if (response.status === 401) {
      router.replace("/admin");
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not open this answer sheet.");
      return;
    }
    setData(body);
  }

  useEffect(() => {
    if (email) load();
  }, [email, role]);

  async function grade() {
    setScoring(true);
    setError("");
    try {
      const response = await fetch("/api/admin/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Scoring failed");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setScoring(false);
    }
  }

  const scores = data?.scores;
  const groups = [];
  for (const row of data?.sheet || []) {
    const last = groups[groups.length - 1];
    if (!last || last.title !== row.sectionTitle) groups.push({ title: row.sectionTitle, rows: [row] });
    else last.rows.push(row);
  }

  return (
    <AdminFrame title={data?.candidate?.name || "Answer sheet"}>
      {error ? <p className="alert">{error}</p> : null}
      {!data ? <p>Loading the answer sheet…</p> : null}
      {data ? (
        <>
          <section className="best-card">
            <div>
              <p className="kicker">{data.candidate.status}</p>
              <div className="identity light">
                <p><span>Name</span> {data.candidate.name || "Not given"}</p>
                <p><span>Email</span> {data.candidate.email}</p>
                <p><span>Position</span> {data.candidate.roleTitle}</p>
              </div>
              <p className="mark">
                {scores ? oneDecimal(scores.finalMark) : "–"}
                <small> / 100</small>
              </p>
              <p>{scoreNote(data.candidate, scores)}</p>
              <p>
                Registered {formatWhen(data.candidate.lastLoginAt)}
                {data.candidate.submittedAt ? ` · Submitted ${formatWhen(data.candidate.submittedAt)}` : ""}
              </p>
              <button className="score-check no-print" type="button" onClick={grade} disabled={scoring}>
                {scoring ? "Checking score…" : "Check score"}
              </button>
            </div>
            <div>
              {(scores?.sections || []).map((section) => (
                <div key={section.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{section.title}</span>
                    <span>{oneDecimal(section.percent)}%</span>
                  </div>
                  <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, section.percent))}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          {groups.map((group) => (
            <section key={group.title} className="panel sheet-block">
              <h2>{group.title}</h2>
              {group.rows.map((row) => (
                <article key={row.id} style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <strong>
                      {row.id === 41 ? "Leadership" : row.id}. {row.prompt}
                    </strong>
                    <span className={`pill ${tone(row.percent)}`}>
                      {row.percent === null ? "Not scored" : `${row.percent}% · ${oneDecimal(row.points)}/${oneDecimal(row.maxPoints)}`}
                    </span>
                  </div>
                  {row.context ? <pre className="context-block">{row.context}</pre> : null}
                  <p className="answer-read">{row.answer.trim() ? row.answer : "No answer."}</p>
                  {row.feedback ? <p className="sub">{row.feedback}</p> : null}
                  <details>
                    <summary>Model answer</summary>
                    <pre className="model-read">{row.modelAnswer}</pre>
                  </details>
                </article>
              ))}
            </section>
          ))}
        </>
      ) : null}
    </AdminFrame>
  );
}
