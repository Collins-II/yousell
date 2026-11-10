import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-28 text-center">
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="text-muted">The listing or page you’re looking for doesn’t exist or was removed.</p>
      <Link href="/" className="btn-primary">Back to home</Link>
    </div>
  );
}
