"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin/dashboard", label: "Candidates" },
  { href: "/admin/compare", label: "Comparison" },
];

export function AdminFrame({ title, extra, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [scoring, setScoring] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function refresh() {
      const session = await fetch("/api/admin/session").then((response) => response.json()).catch(() => null);
      if (!session?.admin) {
        router.replace("/admin");
        return;
      }
      const status = await fetch("/api/admin/scoring").then((response) => response.json()).catch(() => null);
      if (!ignore && status && !status.error) setScoring(status);
    }
    refresh();
    const id = setInterval(refresh, 10000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [router]);

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin");
  }

  const scoringText = scoring?.current
    ? `Scoring ${scoring.current}`
    : scoring?.lastError
      ? "Last score failed"
      : "Waiting for submitted papers";

  return (
    <div className="panel-shell">
      <aside className="panel-side">
        <a className="side-brand" href="/admin/dashboard">
          <span className="brand-mark">AT</span>
          <span>
            <strong>Althakeel Interview</strong>
            <small>Interview panel</small>
          </span>
        </a>
        <nav className="side-nav">
          {LINKS.map((link) => (
            <a key={link.href} className={pathname === link.href ? "side-link active" : "side-link"} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="side-score">
          <p>Auto scoring</p>
          <strong>{scoringText}</strong>
          <span>OpenAI checks about once a minute</span>
        </div>
        <button className="side-logout" type="button" onClick={logout}>Log out</button>
      </aside>
      <div className="panel-content">
        <div className="page-head">
          <div>
            <h1>{title}</h1>
            <p className="page-note">Submitted papers are scored automatically.</p>
          </div>
          {extra}
        </div>
        {children}
      </div>
    </div>
  );
}
