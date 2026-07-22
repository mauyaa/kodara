"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/error-tracking";

/**
 * Catches errors thrown by the root layout itself (font loading, theme
 * script, providers) -- app/error.tsx can't reach those since it renders
 * inside the root layout, not around it. Next.js requires this file to
 * render its own <html>/<body> since it replaces the layout entirely.
 * Deliberately minimal: it must not depend on anything that could itself be
 * the reason the root layout just failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "global-error-boundary");
  }, [error]);

  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "1rem" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ maxWidth: "24rem", fontSize: "14px", color: "#6b6b6b" }}>
          Kodara hit an unexpected error. Try reloading the page.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.75rem",
            background: "#1a5a3e",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
