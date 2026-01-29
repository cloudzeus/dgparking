/**
 * Global error boundary. Must define own <html>/<body> (replaces root layout).
 * Kept as Server Component (no "use client") so prerender does not run client hooks
 * and avoids "Cannot read properties of null (reading 'useContext')" during build.
 * "Try again" uses a link to "/" since we cannot call reset() without client.
 */
export const dynamic = "force-dynamic";

export default function GlobalError({
  error: _error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ color: "#b91c1c", fontSize: "1.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#6b7280", marginBottom: "1rem" }}>An unexpected error occurred.</p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
            backgroundColor: "#18181b",
            color: "#fff",
            border: "none",
            borderRadius: "0.375rem",
            textDecoration: "none",
          }}
        >
          Try again
        </a>
      </body>
    </html>
  );
}
