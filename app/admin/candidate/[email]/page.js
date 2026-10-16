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
  if (!candidate.answered) return "No answers have been saved yet, so there is nothing to score.";
  if (!candidate.submittedAt) return "Saved answers are scored about once a minute. The paper stays In exam until they press Finish.";
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
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Scoring failed");
      await load();
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Scoring could not reach the server. Refresh and try Check score again." : err.message);
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
          <section className="studio-lead">
            <div>
              <p className="studio-kicker">{data.candidate.submittedAt ? (data.candidate.status === "Graded" ? "Done" : "Submitted") : "In exam"}</p>
              <p className="studio-mark">{scores ? oneDecimal(scores.finalMark) : "–"}</p>
              <p>{scoreNote(data.candidate, scores)}</p>
              <button className="studio-btn no-print" type="button" onClick={grade} disabled={scoring}>
                {scoring ? "Checking…" : "Check score"}
              </button>
            </div>
            <div>
              <h2>{data.candidate.name || "Name not given"}</h2>
              <p>{data.candidate.email}</p>
              <p>{data.candidate.roleTitle}</p>
              <p className="studio-note">
                Registered {formatWhen(data.candidate.lastLoginAt)}
                {data.candidate.submittedAt ? ` · Submitted ${formatWhen(data.candidate.submittedAt)}` : ""}
              </p>
            </div>
            <dl className="studio-sections">
              {(scores?.sections || []).map((section) => (
                <div key={section.id}>
                  <dt>{section.title}</dt>
                  <dd>{oneDecimal(section.percent)}%</dd>
                </div>
              ))}
            </dl>
          </section>

          {groups.map((group) => (
            <section key={group.title} className="studio-group">
              <h2>{group.title}</h2>
              {group.rows.map((row) => (
                <article key={row.id} className="studio-q">
                  <div className="studio-no">{row.id === 41 ? "L" : String(row.id).padStart(2, "0")}</div>
                  <div>
                    <h3>{row.prompt}</h3>
                    {row.context ? <pre className="context-block">{row.context}</pre> : null}
                    <p className="answer-read">{row.answer.trim() ? row.answer : "No answer."}</p>
                    {row.feedback ? <p className="studio-note">{row.feedback}</p> : null}
                    <details>
                      <summary>Model answer</summary>
                      <pre className="model-read">{row.modelAnswer}</pre>
                    </details>
                  </div>
                  <p className={`studio-score ${tone(row.percent)}`}>
                    {row.percent === null ? "—" : `${oneDecimal(row.points)}/${oneDecimal(row.maxPoints)}`}
                  </p>
                </article>
              ))}
            </section>
          ))}
        </>
      ) : null}
    </AdminFrame>
  );
}
