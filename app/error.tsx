"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-28 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-muted">We couldn’t load this page. Please try again.</p>
      <button onClick={reset} className="btn-primary">Try again</button>
    </div>
  );
}
