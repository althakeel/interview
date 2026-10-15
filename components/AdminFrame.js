"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/admin/dashboard", label: "Candidates" },
  { href: "/admin/compare", label: "Comparison" },
  { href: "/admin/tasks", label: "Tasks" },
];

export function AdminFrame({ title, note, extra, children }) {
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
    <div className="panel-shell studio">
      <aside className="panel-side">
        <a className="side-brand" href="/admin/dashboard">
          <Logo />
          <small>Interview panel</small>
        </a>
        <nav className="side-nav">
          {LINKS.map((link, index) => (
            <a key={link.href} className={pathname === link.href ? "side-link active" : "side-link"} href={link.href}>
              <em>{String(index + 1).padStart(2, "0")}</em>
              {link.label}
            </a>
          ))}
        </nav>
        <p className="side-score-line">{scoringText}</p>
        <button className="side-logout" type="button" onClick={logout}>Log out</button>
      </aside>
      <div className="panel-content">
        <header className="studio-mast">
          <p className="studio-kicker">Althakeel</p>
          <div className="studio-mast-row">
            <h1>{title}</h1>
            {extra}
          </div>
          {note ? <p className="studio-note">{note}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
