import type { Metadata } from "next";

import { AppShell } from "@/components/ui";
import { createSupabaseAuthServerClient, isSupabaseAuthConfigured } from "@/infrastructure/auth/supabase-auth-server";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Waypoint",
    template: "%s · Waypoint",
  },
  description:
    "Turn your career evidence into clearer job decisions, stronger CV choices, and reusable applications.",
  applicationName: "Waypoint",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let authenticated = false;
  if (isSupabaseAuthConfigured()) {
    const auth = await createSupabaseAuthServerClient();
    authenticated = Boolean((await auth.auth.getUser()).data.user);
  }
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell authenticated={authenticated}>{children}</AppShell>
      </body>
    </html>
  );
}
