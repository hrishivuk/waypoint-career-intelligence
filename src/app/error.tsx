"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Waypoint page failed", { digest: error.digest, category: error.name }); }, [error]);
  return <main id="main-content" className="mx-auto max-w-2xl px-6 py-24 text-center"><h1 className="text-3xl font-semibold text-slate-950">Something went wrong.</h1><p className="mt-4 text-slate-600">Your saved information has not been changed. Try loading this page again.</p><button type="button" onClick={reset} className="mt-7 min-h-11 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Try again</button></main>;
}
