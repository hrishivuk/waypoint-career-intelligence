import type { Metadata } from "next";

import { AppShell } from "@/components/ui";
import { getWorkspaceMode } from "@/infrastructure/workspace/server-workspace";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Waypoint",
    template: "%s · Waypoint",
  },
  description:
    "A personal AI-assisted career intelligence workspace built around confirmed evidence.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const workspaceMode = await getWorkspaceMode();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell workspaceMode={workspaceMode}>{children}</AppShell>
      </body>
    </html>
  );
}
