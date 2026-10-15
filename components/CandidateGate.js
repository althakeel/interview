"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MARK_SCHEME } from "@/lib/scheme";
import { Logo } from "@/components/Logo";

export function CandidateGate({ role }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [session, setSession] = useState(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [minutes, setMinutes] = useState(role.minutes);
  const examPath = `/${role.id}/exam`;
  const donePath = `/${role.id}/done`;

  useEffect(() => {
    let ignore = false;
    fetch(`/api/candidate/session?role=${role.id}`)
      .then((response) => response.json())
      .then((data) => {
        if (ignore) return;
        if (data.candidate?.submittedAt) {
          router.replace(donePath);
          return;
        }
        if (data.candidate?.startedAt) {
          router.replace(examPath);
          return;
        }
        setSession(data);
      })
      .catch(() => setSession({ candidate: null }));
    return () => {
      ignore = true;
    };
  }, [router, role.id, examPath, donePath]);

  useEffect(() => {
    fetch("/api/roles")
      .then((response) => response.json())
      .then((data) => {
        const match = data.roles?.find((item) => item.id === role.id);
        if (match?.minutes) setMinutes(match.minutes);
      })
      .catch(() => {});
  }, [role.id]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/candidate/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: role.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      const next = await fetch(`/api/candidate/session?role=${role.id}`).then((item) => item.json());
      if (next.candidate?.submittedAt) router.replace(donePath);
      else if (next.candidate?.startedAt) router.replace(examPath);
      else setSession(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/exam/start", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start.");
      router.push(examPath);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/candidate/session", { method: "DELETE" });
    setSession({ candidate: null });
    setName("");
    setEmail("");
  }

  if (session === undefined) return <p className="center">Opening the examination…</p>;

  const signedIn = session.candidate;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const clock = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
  const outline = role.sections?.length
    ? role.sections
    : role.id === "gm"
      ? MARK_SCHEME.map((section) => ({
          id: section.id,
          title: section.title,
          count: `${section.questionIds.length} questions`,
        }))
      : role.id === "brand"
        ? [
            { id: "A", title: "Multiple choice", count: "20 questions" },
            { id: "B", title: "Written responses", count: "5 questions" },
          ]
        : [];

  return (
    <main className="split">
      <section className="panel-dark">
        <div>
          <Logo />
          <p className="kicker">Althakeel Interview</p>
          <h1>{role.title}</h1>
          <p className="lede">{role.summary}</p>
          <div className="facts">
            <div className="fact">
              <strong>{clock}</strong>
              <span>Countdown</span>
            </div>
            <div className="fact">
              <strong>{session.questionCount || (role.id === "gm" ? 41 : 25)}</strong>
              <span>Questions</span>
            </div>
            <div className="fact">
              <strong>100</strong>
              <span>Marks</span>
            </div>
          </div>
        </div>
      </section>
      <section className="panel-light">
        <div className="card">
          {signedIn ? (
            <>
              <h2>Ready to begin</h2>
              <div className="identity">
                <p><span>Name</span> {session.candidate.name || "Not given"}</p>
                <p><span>Email</span> {session.candidate.email}</p>
              </div>
              <p className="sub">
                Press Start and the {minutes}-minute clock begins. It cannot be paused.
              </p>
              <ul className="section-list">
                {outline.map((section) => (
                  <li key={section.id}>
                    <strong>{section.title}</strong>
                    <span>{section.count}</span>
                  </li>
                ))}
              </ul>
              {error ? <p className="alert">{error}</p> : null}
              <div className="actions">
                <button className="copper" type="button" onClick={start} disabled={busy}>
                  {busy ? "Starting…" : "Start examination"}
                </button>
                <button className="ghost" type="button" onClick={logout}>
                  Use another email
                </button>
              </div>
            </>
          ) : (
            <form className="stack" onSubmit={login}>
              <h2>Candidate sign in</h2>
              <p className="sub">
                Use your own name and email. The same name or email cannot be registered twice for this position.
              </p>
              <div>
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              {error ? <p className="alert">{error}</p> : null}
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Continue"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
