"use client";

import { useParams } from "next/navigation";
import { CandidateGate } from "@/components/CandidateGate";
import { getRole } from "@/lib/roles";

export default function RoleEntrance() {
  const params = useParams();
  const role = getRole(params.role);
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
