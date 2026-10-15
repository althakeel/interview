"use client";

import { useEffect, useState } from "react";
import { listRoles } from "@/lib/roles";
import { Logo } from "@/components/Logo";

function markFor(role) {
  if (role.id === "gm") return "GM";
  if (role.id === "brand") return "BA";
  return String(role.short || role.title || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

export default function HomePage() {
  const [roles, setRoles] = useState(listRoles);

  useEffect(() => {
    fetch("/api/roles")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.roles) && data.roles.length) setRoles(data.roles);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="panel-light picker">
      <div className="picker-card">
        <Logo onLight />
        <p className="kicker">Althakeel Interview</p>
        <h1>Choose the position</h1>
        <p className="lede">
          Each role has its own examination. Sign in with your name and email on the position you are applying for.
        </p>
        <div className="role-grid">
          {roles.map((role) => (
            <a key={role.id} className="role-card" href={`/${role.id}`}>
              <span className="brand-mark small">{markFor(role)}</span>
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
