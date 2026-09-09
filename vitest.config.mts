import "dotenv/config";
import { defineConfig } from "vitest/config";

// These three integration test files all create real CASH Payment rows
// against the one shared Neon database (no per-test transaction isolation).
// cash-shift-reconciliation.test.ts sums every CASH payment inside its
// shift's open/close time window — correct production behavior, but it
// means a payment created by any *other* file running at the same moment
// lands in that window too. Running test files in parallel (Vitest's
// default) made this genuinely nondeterministic: passes alone, intermittently
// fails as part of the full suite. Isolating just these three files into
// their own sequential project fixes the race without paying the wall-clock
// cost of serializing the whole suite, most of which never touches money.
const MONEY_SENSITIVE_TESTS = [
  "tests/cash-shift-reconciliation.test.ts",
  "tests/split-payment.test.ts",
  "tests/recipe-deduction.test.ts",
];

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "money-sensitive",
          include: MONEY_SENSITIVE_TESTS,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: MONEY_SENSITIVE_TESTS,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
      "server-only": `${import.meta.dirname}/tests/mocks/server-only.ts`,
    },
  },
});
