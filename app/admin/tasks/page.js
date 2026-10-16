"use client";

import { Children, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminFrame } from "@/components/AdminFrame";
import { formatDuration, oneDecimal } from "@/lib/format";

export default function TasksPage() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [paper, setPaper] = useState(null);
  const [opening, setOpening] = useState("");
  const [sheet, setSheet] = useState("");
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [ready, setReady] = useState(false);
  const [storage, setStorage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/overview");
    if (response.status === 401) {
      router.replace("/admin");
      return [];
    }
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not load tasks.");
      return [];
    }
    setOffset(body.serverNow - Date.now());
    setRoles(body.roles || []);
    setPeople(body.candidates || []);
    setStorage(body.storage || "");
    setReady(true);
    return body.roles || [];
  }

  useEffect(() => {
    load();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(load, 8000);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  async function createJob(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/jobs", { method: "POST", body: new FormData(event.target) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not add the interview.");
      setNotice(`${body.title} is open with ${body.questionCount} questions.`);
      event.target.reset();
      setSheet("");
      const list = await load();
      const created = list.find((role) => role.id === body.id);
      if (created) openPaper(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function openPaper(role) {
    setOpening(role.id);
    setError("");
    setSheet("");
    setPaper(null);
    try {
      const response = await fetch(`/api/admin/questions?role=${encodeURIComponent(role.id)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not open the questions.");
      setPaper(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setOpening("");
    }
  }

  async function replacePaper(event) {
    event.preventDefault();
    setReplacing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: new FormData(event.target) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not read that file.");
      setNotice(`Questions replaced. ${body.questionCount} questions are ready.`);
      event.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setReplacing(false);
    }
  }

  const ongoing = people.filter((row) => row.status === "In exam");
  const done = people.filter((row) => row.status === "Graded");
  const pending = people.filter((row) => row.status !== "In exam" && row.status !== "Graded");

  function timeLeft(row) {
    if (!row.startedAt) return null;
    const end = new Date(row.startedAt).getTime() + (row.durationMs || 90 * 60 * 1000);
    return end - (now + offset);
  }

  return (
    <AdminFrame title="Tasks" note="Live exams, papers still waiting, and finished scores. This refreshes on its own.">
      {storage === "local" ? (
        <p className="notice">
          This computer is using its own empty copy of the papers, so live exams from the server do not appear here.
        </p>
      ) : null}
      {error ? <p className="alert">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      {!ready ? <p className="studio-empty">Loading the live board…</p> : null}
      {ready ? <section className="task-board">
        <TaskColumn title="Ongoing" count={ongoing.length} hint="In the exam now" empty="No exam is running.">
          {ongoing.map((row) => (
            <TaskPerson key={`${row.role}-${row.email}`} row={row} detail={timeLeft(row) === null ? "Started" : `${formatDuration(timeLeft(row))} left`} />
          ))}
        </TaskColumn>
        <TaskColumn title="Pending" count={pending.length} hint="Not started, or waiting for a score" empty="Nothing is waiting.">
          {pending.map((row) => (
            <TaskPerson key={`${row.role}-${row.email}`} row={row} detail={row.status === "Submitted" ? "Waiting for a score" : "Has not started"} />
          ))}
        </TaskColumn>
        <TaskColumn title="Done" count={done.length} hint="Score is ready" empty="No scored papers yet.">
          {done.map((row) => (
            <TaskPerson key={`${row.role}-${row.email}`} row={row} detail={row.finalMark === null ? "Scored" : `${oneDecimal(row.finalMark)} / 100`} />
          ))}
        </TaskColumn>
      </section> : null}

      <details className="studio-fold">
        <summary>Question papers</summary>
        <p className="studio-note">Open a position to read its questions, or add a new interview.</p>
      <div className="studio-filters" role="tablist" aria-label="Positions">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            className={paper?.role?.id === role.id && !sheet ? "on" : ""}
            onClick={() => openPaper(role)}
            disabled={opening === role.id}
          >
            {role.short}
            <small>{role.questionCount || 0}</small>
          </button>
        ))}
        <button type="button" className={sheet === "add" ? "on" : ""} onClick={() => setSheet(sheet === "add" ? "" : "add")}>
          New position
        </button>
        <button type="button" className={sheet === "replace" ? "on" : ""} onClick={() => setSheet(sheet === "replace" ? "" : "replace")}>
          Replace paper
        </button>
      </div>

      {sheet === "add" ? (
        <form className="studio-form" onSubmit={createJob}>
          <label>
            Job title
            <input name="title" required placeholder="Sales Manager" />
          </label>
          <label>
            Short name
            <input name="short" placeholder="Sales" />
          </label>
          <label>
            Minutes
            <input name="minutes" type="number" min={5} max={240} defaultValue={60} required />
          </label>
          <label className="wide">
            Summary
            <input name="summary" placeholder="What this interview covers" />
          </label>
          <label className="wide">
            Questions and answers
            <input name="file" type="file" accept=".pdf,.txt,.md,.json,application/pdf,text/plain,application/json" required />
          </label>
          <button className="studio-btn" type="submit" disabled={creating}>
            {creating ? "Reading the file…" : "Add interview"}
          </button>
        </form>
      ) : null}

      {sheet === "replace" ? (
        <form className="studio-form" onSubmit={replacePaper}>
          <label>
            Position
            <select name="role" aria-label="Position" defaultValue={paper?.role?.id || roles[0]?.id || "gm"}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.short} · {role.questionCount || 0} questions</option>
              ))}
            </select>
          </label>
          <label>
            File
            <input name="file" type="file" accept=".pdf,.txt,.md,.json,application/pdf,text/plain,application/json" required />
          </label>
          <button className="studio-btn" type="submit" disabled={replacing || roles.length === 0}>
            {replacing ? "Reading the file…" : "Upload questions"}
          </button>
        </form>
      ) : null}

      {paper ? <QuestionPaper paper={paper} /> : opening ? <p className="studio-empty">Opening the paper…</p> : null}
      </details>
    </AdminFrame>
  );
}

function TaskColumn({ title, count, hint, empty, children }) {
  const filled = Children.count(children);
  return (
    <section className={`task-col task-${title.toLowerCase()}`}>
      <header>
        <h2>{title}</h2>
        <b>{count}</b>
      </header>
      <p>{hint}</p>
      {filled ? children : <p className="studio-empty">{empty}</p>}
    </section>
  );
}

function TaskPerson({ row, detail }) {
  return (
    <a className="task-person" href={`/admin/candidate/${encodeURIComponent(row.email)}?role=${row.role}`}>
      <strong>{row.name || "Name not given"}</strong>
      <span>{row.roleTitle}</span>
      <em>{detail}</em>
    </a>
  );
}

function QuestionPaper({ paper }) {
  const groups = [];
  for (const question of paper.questions || []) {
    const last = groups[groups.length - 1];
    if (!last || last.title !== question.sectionTitle) groups.push({ title: question.sectionTitle, rows: [question] });
    else last.rows.push(question);
  }

  return (
    <div>
      <header className="studio-paper-head">
        <h2>{paper.role?.title}</h2>
        <p>{paper.questions?.length || 0} questions</p>
      </header>
      {groups.map((group) => (
        <section key={group.title} className="studio-group">
          <h2>{group.title}</h2>
          {group.rows.map((question) => (
            <article key={question.id} className="studio-q">
              <div className="studio-no">{String(question.id).padStart(2, "0")}</div>
              <div>
                <h3>{question.prompt}</h3>
                {question.context ? <pre className="context-block">{question.context}</pre> : null}
                {question.choices?.length ? (
                  <ul className="studio-choices">
                    {question.choices.map((choice) => (
                      <li key={choice.key} className={choice.key === question.correct ? "right" : ""}>
                        <b>{choice.key}</b>
                        <span>{choice.text}</span>
                        {choice.key === question.correct ? <em>Answer</em> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {question.modelAnswer ? (
                  <blockquote className="studio-model">
                    <span>Model answer</span>
                    {question.modelAnswer}
                  </blockquote>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
