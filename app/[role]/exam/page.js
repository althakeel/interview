"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { answerText, formatDuration } from "@/lib/format";
import { Logo } from "@/components/Logo";

const SHORT_SECTIONS = {
  A: "Leadership",
  B: "Marketing",
  C: "Marketplaces",
  D: "Technology",
  E: "Finance",
  F: "Merchandising",
  G: "Case study",
  L: "Final question",
};

export default function ExamPage() {
  const router = useRouter();
  const pathname = usePathname();
  const role = pathname.split("/").filter(Boolean)[0] === "brand" ? "brand" : "gm";
  const home = `/${role}`;
  const donePath = `/${role}/done`;
  const [pack, setPack] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [saveLabel, setSaveLabel] = useState("Saved");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const answersRef = useRef({});
  const offsetRef = useRef(0);
  const queue = useRef({ running: false, pending: false });
  const locked = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/candidate/session?role=${role}`)
      .then((response) => response.json())
      .then((data) => {
        if (ignore) return;
        if (!data.candidate) {
          router.replace(home);
          return;
        }
        if (data.candidate.submittedAt || !data.candidate.startedAt) {
          router.replace(data.candidate.submittedAt ? donePath : home);
          return;
        }
        offsetRef.current = data.serverNow - Date.now();
        answersRef.current = data.answers || {};
        setAnswers(data.answers || {});
        setPack(data);
      })
      .catch(() => setError("Could not load the examination."));
    return () => {
      ignore = true;
    };
  }, [router, role, home, donePath]);

  async function persist() {
    if (queue.current.running) {
      queue.current.pending = true;
      return;
    }
    queue.current.running = true;
    queue.current.pending = false;
    setSaveLabel("Saving");
    try {
      const response = await fetch("/api/exam/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersRef.current }),
      });
      const data = await response.json();
      if (data.submitted) {
        router.replace(donePath);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Save failed");
      setSaveLabel("Saved");
    } catch (err) {
      setSaveLabel("Not saved");
      setError(err.message);
    } finally {
      queue.current.running = false;
      if (queue.current.pending) persist();
    }
  }

  async function submit() {
    if (locked.current) return;
    locked.current = true;
    setSaveLabel("Submitting");
    setConfirming(false);
    try {
      const response = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersRef.current }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Submit failed");
      router.replace(donePath);
    } catch (err) {
      locked.current = false;
      setError(err.message);
      setSaveLabel("Not submitted");
    }
  }

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (!pack?.candidate?.startedAt) return undefined;
    const tick = () => {
      const end = new Date(pack.candidate.startedAt).getTime() + pack.durationMs;
      const left = end - (Date.now() + offsetRef.current);
      setRemaining(left);
      if (left <= 0) submitRef.current();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [pack]);

  useEffect(() => {
    const onLeave = (event) => {
      if (locked.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const questions = pack?.questions || [];
  const current = questions[index];
  const groups = useMemo(() => {
    const list = [];
    for (const question of questions) {
      const last = list[list.length - 1];
      if (!last || last.id !== question.sectionId) {
        list.push({ id: question.sectionId, title: question.sectionTitle, items: [question] });
      } else {
        last.items.push(question);
      }
    }
    return list;
  }, [questions]);

  const answeredCount = questions.filter((question) => answerText(answers, question.id).trim()).length;
  const blankCount = questions.length - answeredCount;
  const words = current ? answerText(answers, current.id).trim().split(/\s+/).filter(Boolean).length : 0;

  useEffect(() => {
    if (!current) return;
    document.getElementById(`qnav-${current.id}`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function goTo(nextIndex) {
    setIndex(nextIndex);
    window.setTimeout(() => document.getElementById("answer")?.focus(), 0);
  }

  function updateAnswer(id, value) {
    const next = { ...answersRef.current, [String(id)]: value };
    answersRef.current = next;
    setAnswers(next);
    setSaveLabel("Unsaved");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(persist, 700);
  }

  if (!current) {
    return <p className="center">{error || "Loading questions…"}</p>;
  }

  const timerClass = remaining !== null && remaining < 5 * 60 * 1000
    ? "timer danger"
    : remaining !== null && remaining < 10 * 60 * 1000
      ? "timer warning"
      : "timer";

  return (
    <div className="exam-shell">
      <header className="exam-top">
        <div className="exam-brand">
          <Logo className="compact" />
          <div>
            <strong>{pack.candidate.name || "Candidate"}</strong>
            <small>{pack.candidate.email}</small>
          </div>
        </div>
        <div className="timer-wrap">
          <span>Time left</span>
          <div className={timerClass} aria-label="Time remaining">
            {remaining === null ? (role === "brand" ? "01:15:00" : "01:30:00") : formatDuration(remaining)}
          </div>
        </div>
        <div className="actions">
          <span className={`save-state ${saveLabel === "Saved" ? "is-saved" : ""}`}>{saveLabel === "Saved" ? "Saved" : saveLabel}</span>
          <button className="copper" type="button" onClick={() => setConfirming(true)}>
            Finish exam
          </button>
        </div>
      </header>
      <div className="exam-body">
        <aside className="exam-map">
          <div className="map-summary">
            <div className="map-summary-row">
              <strong>{answeredCount} of {questions.length} answered</strong>
              <span>{blankCount} left</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <i style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
            </div>
            <p className="map-legend"><span className="dot" /> Not yet <span className="dot done" /> Answered <span className="dot current" /> Here</p>
          </div>
          {groups.map((group) => {
            const doneInGroup = group.items.filter((question) => answerText(answers, question.id).trim()).length;
            const active = group.items.some((question) => question.id === current.id);
            return (
              <div key={group.id} className={active ? "map-group active" : "map-group"}>
                <p className="map-section">
                  <span>{role === "gm" ? (SHORT_SECTIONS[group.id] || group.title) : group.title}</span>
                  <span>{doneInGroup}/{group.items.length}</span>
                </p>
                <div className="q-grid">
                  {group.items.map((question) => {
                    const position = questions.findIndex((item) => item.id === question.id);
                    const filled = Boolean(answerText(answers, question.id).trim());
                    const className = [
                      "q-btn",
                      position === index ? "current" : "",
                      filled ? "done" : "",
                    ].filter(Boolean).join(" ");
                    const label = question.id === 41 ? "Final" : String(question.id);
                    return (
                      <button
                        key={question.id}
                        id={`qnav-${question.id}`}
                        className={className}
                        type="button"
                        title={`${group.title}, question ${label}${filled ? ", answered" : ", not answered yet"}`}
                        onClick={() => goTo(position)}
                      >
                        {question.id === 41 ? "L" : question.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>
        <main className="exam-main">
          <div className="exam-scroll">
            <p className="section-kicker">
              {current.sectionTitle} · Question {index + 1} of {questions.length}
            </p>
            <h1>
              {current.id === 41 ? "" : `${current.id}. `}
              {current.prompt}
            </h1>
            {current.context ? <pre className="context-block">{current.context}</pre> : null}
            {current.type === "choice" ? (
              <div className="choice-list" role="radiogroup" aria-label="Your answer">
                {(current.choices || []).map((choice) => {
                  const selected = answerText(answers, current.id).trim().toUpperCase() === choice.key;
                  return (
                    <button
                      key={choice.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={selected ? "choice on" : "choice"}
                      onClick={() => updateAnswer(current.id, choice.key)}
                    >
                      <b>{choice.key}</b>
                      <span>{choice.text}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="answer-label-row">
                  <label htmlFor="answer">Your answer</label>
                  <span>{words === 1 ? "1 word" : `${words} words`} · saved automatically</span>
                </div>
                <textarea
                  id="answer"
                  className="answer"
                  value={answerText(answers, current.id)}
                  onChange={(event) => updateAnswer(current.id, event.target.value)}
                  placeholder="Type your answer here. Clear, practical points are enough."
                />
              </>
            )}
            {error ? <p className="alert">{error}</p> : null}
          </div>
          <div className="exam-nav">
            <button className="ghost" type="button" disabled={index === 0} onClick={() => goTo(index - 1)}>
              Previous
            </button>
            <p className="progress-note">Question {index + 1} of {questions.length}</p>
            <button
              className="primary"
              type="button"
              onClick={() => (index === questions.length - 1 ? setConfirming(true) : goTo(index + 1))}
            >
              {index === questions.length - 1 ? "Review and finish" : "Next question"}
            </button>
          </div>
        </main>
      </div>
      {confirming ? (
        <div className="modal-back">
          <div className="modal">
            <h2>Submit the examination?</h2>
            <p className="sub">
              {blankCount
                ? `${blankCount} questions are still blank. Blank answers receive no marks.`
                : "Every question has an answer. You can still go back before submitting."}
            </p>
            <div className="actions">
              <button className="copper" type="button" onClick={submit}>Submit now</button>
              <button className="ghost" type="button" onClick={() => setConfirming(false)}>Keep writing</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
