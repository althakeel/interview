"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatWhen } from "@/lib/format";

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
    <main className="panel-light">
      <div className="card">
        <div className="brand-mark">{role === "brand" ? "BA" : "GM"}</div>
        <h2>Examination submitted</h2>
        <div className="identity">
          <p><span>Name</span> {candidate.name || "Not given"}</p>
          <p><span>Email</span> {candidate.email}</p>
        </div>
        <p className="sub">Finished at {formatWhen(candidate.submittedAt)}. The interview panel will review the answer sheet.</p>
        <button className="ghost" type="button" onClick={logout}>Close</button>
      </div>
    </main>
  );
}
