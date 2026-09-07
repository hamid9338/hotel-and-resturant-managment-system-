// Real `server-only` unconditionally throws — Next.js's webpack config swaps
// in a no-op file for server-side bundles and this throwing one only for
// client bundles. Vitest has no such swap, so it always hits the throwing
// version; this alias target (wired up in vitest.config.mts) stands in for
// that server-side no-op so DB-backed service modules can be imported in tests.
export {};
