"use client";

/**
 * Minimal global error boundary. Must define own <html>/<body> (replaces root layout).
 * Uses only inline styles and native HTML to avoid any React context (e.g. Toaster)
 * which causes "Cannot read properties of null (reading 'useContext')" during prerender.
 */
export const dynamic = "force-dynamic";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ color: "#b91c1c", fontSize: "1.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#6b7280", marginBottom: "1rem" }}>An unexpected error occurred.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
            backgroundColor: "#18181b",
            color: "#fff",
            border: "none",
            borderRadius: "0.375rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
