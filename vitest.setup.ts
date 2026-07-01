// Minimal env so modules that import lib/env.ts don't fail during unit tests.
// Pure-logic modules (lib/channels, lib/analysis prompt builders) should not need
// a real DB or API key; these are placeholder values only.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5455/test?schema=public";
process.env.AUTH_SECRET ??= "test-secret";
process.env.APP_URL ??= "http://localhost:3000";
