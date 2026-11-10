"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page] Rendering failed", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-28 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-muted">We couldn’t load this page. Please try again.</p>
      {error.digest && <p className="text-xs text-muted">Error reference: {error.digest}</p>}
      <button onClick={reset} className="btn-primary">Try again</button>
    </div>
  );
}
