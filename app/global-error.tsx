"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself (app/layout.tsx) — the one
// case app/error.tsx can't cover, since a same-segment error boundary never
// catches its own segment's errors. Deliberately minimal and self-contained:
// no ThemeProvider/ToastProvider/PwaRegister, no Google Fonts, no theme-flash
// script — if any of those (or the root layout importing them) is what
// threw, re-importing the same things here would just throw again. Must
// render its own <html>/<body> since it replaces the entire root layout.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf9f7", color: "#1a1a1a" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100dvh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#666", margin: 0 }}>
            An unexpected error occurred loading the application. Try reloading the page.
          </p>
          <button
            onClick={reset}
            style={{
              borderRadius: "0.5rem",
              border: "1px solid #d4d4d4",
              background: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
