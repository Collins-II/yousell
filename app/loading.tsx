export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy>
      <div className="mb-8 h-9 w-56 animate-pulse rounded-lg bg-line" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-[4/3] animate-pulse bg-line" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-1/2 animate-pulse rounded bg-line" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
