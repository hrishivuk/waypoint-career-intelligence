import { Skeleton } from "@/components/ui/skeleton";

export default function CareerProfileLoading() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4">
      <Skeleton className="h-7 w-64 max-w-full" />
      <Skeleton className="h-4 w-[36rem] max-w-full" />
      <div className="grid gap-4 pt-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading Career Profile…</span>
    </section>
  );
}
