"use client";

import { listRoles } from "@/lib/roles";

export default function HomePage() {
  const roles = listRoles();

  return (
    <main className="panel-light picker">
      <div className="picker-card">
        <div className="brand-mark">AT</div>
        <p className="kicker">Althakeel Interview</p>
        <h1>Choose the position</h1>
        <p className="lede">
          Each role has its own examination. Sign in with your name and email on the position you are applying for.
        </p>
        <div className="role-grid">
          {roles.map((role) => (
            <a key={role.id} className="role-card" href={`/${role.id}`}>
              <span className="brand-mark small">{role.id === "gm" ? "GM" : "BA"}</span>
              <h2>{role.title}</h2>
              <p>{role.summary}</p>
              <strong>{role.minutes} minutes</strong>
            </a>
          ))}
        </div>
        <a className="ghost" href="/admin">Interview panel</a>
      </div>
    </main>
  );
}
