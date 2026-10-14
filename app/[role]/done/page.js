"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatWhen } from "@/lib/format";
import { Logo } from "@/components/Logo";

export default function DonePage() {
  const router = useRouter();
  const pathname = usePathname();
  const role = pathname.split("/").filter(Boolean)[0] === "brand" ? "brand" : "gm";
  const home = `/${role}`;
  const examPath = `/${role}/exam`;
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    fetch(`/api/candidate/session?role=${role}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.candidate) {
          router.replace(home);
          return;
        }
        if (!data.candidate.submittedAt) {
          router.replace(data.candidate.startedAt ? examPath : home);
          return;
        }
        setCandidate(data.candidate);
      });
  }, [router, role, home, examPath]);

  async function logout() {
    await fetch("/api/candidate/session", { method: "DELETE" });
    router.replace("/");
  }

  if (!candidate) return <p className="center">Saving your submission…</p>;

  return (
    <main className="done-page">
      <section className="done-dark">
        <Logo />
        <p className="kicker">Althakeel Interview</p>
        <h1>Paper received</h1>
        <p className="lede">The interview panel has your answer sheet. You can close this page.</p>
      </section>
      <section className="done-light">
        <div className="done-card">
          <p className="done-status">Submitted</p>
          <h2>{candidate.name || "Candidate"}</h2>
          <p className="done-email">{candidate.email}</p>
          <dl>
            <div>
              <dt>Finished</dt>
              <dd>{formatWhen(candidate.submittedAt)}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{candidate.roleTitle || "Interview"}</dd>
            </div>
          </dl>
          <button className="primary" type="button" onClick={logout}>Close</button>
        </div>
      </section>
    </main>
  );
}
