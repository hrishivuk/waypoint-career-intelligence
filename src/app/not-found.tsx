import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return <main id="main-content" className="mx-auto max-w-2xl px-6 py-24 text-center"><p className="text-sm font-semibold text-indigo-700">404</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">This page could not be found.</h1><p className="mt-4 text-slate-600">The address may be outdated, or the page may have moved.</p><Link href="/" className={`${buttonStyles.primary} mt-7`}>Return to Waypoint</Link></main>;
}
