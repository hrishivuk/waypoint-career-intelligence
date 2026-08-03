export default function Loading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto w-full max-w-[var(--content-max)] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
    >
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-3 w-28 rounded-full bg-[var(--surface-sunken)]" />
        <div className="mt-4 h-9 max-w-lg rounded-lg bg-[var(--surface-sunken)]" />
        <div className="mt-3 h-4 max-w-2xl rounded bg-[var(--surface-sunken)]" />
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl border border-[var(--border-subtle)] bg-card"
            />
          ))}
        </div>
        <div className="mt-5 h-56 rounded-2xl border border-[var(--border-subtle)] bg-card" />
      </div>
      <p className="sr-only">Loading Waypoint…</p>
    </main>
  );
}
