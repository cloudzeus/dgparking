"use client";

export const dynamic = "force-dynamic";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <pre>{error?.message}</pre>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
