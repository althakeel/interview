"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((response) => response.json())
      .then((data) => {
        if (data.admin) router.replace("/admin/dashboard");
      });
  }, [router]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign-in failed");
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="split">
      <section className="panel-dark">
        <div>
          <div className="brand-mark">AT</div>
          <p className="kicker">Althakeel Interview</p>
          <h1>Candidate dashboard</h1>
          <p className="lede">
            See who has signed in, open each answer sheet, and compare final marks for every position.
          </p>
        </div>
        <p className="fine">Candidate entrance stays on the home page.</p>
      </section>
      <section className="panel-light">
        <form className="card stack" onSubmit={login}>
          <h2>Panel sign in</h2>
          <p className="sub">Static username and password for the interview panel.</p>
          <div>
            <label htmlFor="username">Username</label>
            <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error ? <p className="alert">{error}</p> : null}
          <div className="actions">
            <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Enter dashboard"}</button>
            <a className="ghost" href="/">Candidate entrance</a>
          </div>
        </form>
      </section>
    </main>
  );
}
