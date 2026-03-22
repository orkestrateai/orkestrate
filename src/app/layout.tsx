import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://orkestrate.space";

export const metadata: Metadata = {
  title: {
    default: "Orkestrate: Multi Agent Orchestration",
    template: "%s | Orkestrate",
  },
  description:
    "Connect multiple AI coding agents to a shared workspace in real-time. Works with Claude Code, OpenCode, Codex, and any MCP-compatible client.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: ["/apple-icon"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Orkestrate",
    title: "Orkestrate: Multi Agent Orchestration",
    description:
      "Connect multiple AI coding agents to a shared workspace in real-time. Works with Claude Code, OpenCode, Codex, and any MCP-compatible client.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orkestrate: Multi Agent Orchestration",
    description:
      "Connect multiple AI coding agents to a shared workspace in real-time.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

import { TooltipProvider } from "@/components/ui/tooltip";
import { headers } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased font-sans`}
      >
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
      </body>
      <SpeedInsights />
      <Analytics />
    </html>
  );
}
