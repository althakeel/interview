"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CandidateGate } from "@/components/CandidateGate";
import { getRole } from "@/lib/roles";

export default function RoleEntrance() {
  const params = useParams();
  const [role, setRole] = useState(() => getRole(params.role));
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const id = params.role;
    const local = getRole(id);
    if (local) setRole(local);
    fetch("/api/roles")
      .then((response) => response.json())
      .then((data) => {
        const match = data.roles?.find((item) => item.id === id);
        if (match) setRole(match);
        else if (!local) setMissing(true);
      })
      .catch(() => {
        if (!local) setMissing(true);
      });
  }, [params.role]);

  if (!role && !missing) return <p className="center">Opening the examination…</p>;
  if (!role) {
    return (
      <main className="panel-light picker">
        <div className="card">
          <h2>That position is not open</h2>
          <a className="ghost" href="/">Back to positions</a>
        </div>
      </main>
    );
  }
  return <CandidateGate role={role} />;
}
