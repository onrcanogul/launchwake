// Minimal env so modules that import lib/env.ts don't fail during unit tests.
// Pure-logic modules (lib/channels, lib/analysis prompt builders) should not need
// a real DB or API key; these are placeholder values only.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5455/test?schema=public";
process.env.AUTH_SECRET ??= "test-secret";
process.env.APP_URL ??= "http://localhost:3000";

// captureError (lib/observability) intentionally console.error's every captured
// failure. Retry/failure-path tests trigger it on purpose, which floods the run
// with dozens of expected "[error]" logs and buries real problems. Filter just
// those; anything else logged to console.error still comes through.
const realConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (args[0] === "[error]") return;
  realConsoleError(...args);
};
