import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader, buttonStyles } from "@/components/ui";
import { SupabaseIdentityProvider } from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export const metadata: Metadata = {
  title: "Knowledge exceptions",
  description: "Inspect facts Waypoint deliberately kept out of active knowledge.",
};
export const dynamic = "force-dynamic";

export default async function KnowledgeExceptionsPage() {
  const actor = await new SupabaseIdentityProvider().getActor();
  const { data, error } = await getSupabaseServerClient()
    .from("knowledge_exceptions")
    .select("id,reason,status,candidate,details,created_at")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Unable to load knowledge exceptions.", { cause: error });
  }
  const exceptions = data ?? [];
  const open = exceptions.filter((item) => item.status === "open");

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Knowledge quality"
        title="Extraction exceptions"
        description="Waypoint activates verified facts automatically. Only conflicting, weak or structurally invalid candidates appear here."
        actions={
          <Link href="/knowledge" className={buttonStyles.secondary}>
            Back to knowledge
          </Link>
        }
      />
      <p className="mb-5 text-sm text-slate-600">
        {open.length} open {open.length === 1 ? "exception" : "exceptions"}
      </p>
      {open.length ? (
        <div className="space-y-4">
          {open.map((item) => (
            <article
              key={String(item.id)}
              className="rounded-2xl border border-amber-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold capitalize text-slate-950">
                  {String(item.reason).replaceAll("_", " ")}
                </h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  Not active
                </span>
              </div>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">
                {JSON.stringify(item.candidate, null, 2)}
              </pre>
              <details className="mt-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium text-indigo-700">
                  Validation details
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs">
                  {JSON.stringify(item.details, null, 2)}
                </pre>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <h2 className="font-semibold text-emerald-950">
            No extraction exceptions
          </h2>
          <p className="mt-2 text-sm text-emerald-800">
            All processed candidates passed deterministic validation.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
