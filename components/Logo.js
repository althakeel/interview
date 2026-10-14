export function Logo({ className = "", onLight = false }) {
  const classes = ["brand-logo", onLight ? "on-light" : "", className].filter(Boolean).join(" ");
  return <img className={classes} src="/althakeel-logo.png" alt="Althakeel" />;
}
