"use client";

import { useState } from "react";

export function DemoCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
    >
      {copied ? "Copied" : "Copy example"}
    </button>
  );
}
