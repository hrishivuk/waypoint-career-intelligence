import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { AppShell } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createSupabaseAuthServerClient, isSupabaseAuthConfigured } from "@/infrastructure/auth/supabase-auth-server";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
});

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
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        plexSans.variable,
        plexMono.variable,
      )}
    >
      <body className="min-h-full">
        <div id="app-root">
          <AppShell authenticated={authenticated}>{children}</AppShell>
        </div>
        <div id="portal-root" />
      </body>
    </html>
  );
}
