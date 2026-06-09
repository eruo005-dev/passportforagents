"use client";

/**
 * Root-layout error boundary. Must render its own <html>/<body> because the
 * root layout itself failed; styles are inlined since globals.css may not load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <p style={{ fontFamily: "ui-monospace, monospace", opacity: 0.6, fontSize: 14 }}>
          500
        </p>
        <h1 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: 420, opacity: 0.7 }}>
          An unexpected error occurred
          {error.digest ? ` (ref ${error.digest})` : ""}. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 24,
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "#fafafa",
            color: "#0a0a0a",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
