export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoScorer } = await import("./lib/autoscore.js");
    startAutoScorer();
  }
}
