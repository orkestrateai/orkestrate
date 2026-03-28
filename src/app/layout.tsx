import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    default: "Orkestrate: Multi Agent AI Orchestration Platform",
    template: "%s | Orkestrate",
  },
  description:
    "Orchestrate multiple AI coding agents on a single codebase with zero conflicts. Works with Claude Code, OpenCode, Codex, Cursor AI, and any MCP-compatible client. The ultimate coordination layer for multi-agent development.",
  keywords: [
    "multi-agent AI orchestration",
    "AI coding agents",
    "multi-agent development",
    "Claude Code coordination",
    "AI code generation",
    "MCP protocol",
    "Model Context Protocol",
    "AI software development",
    "multi-agent workflow",
    "AI code collaboration",
    "autonomous coding",
    "AI development platform",
    "agent orchestration",
    "AI coding assistant",
    "multi-agent AI tools"
  ],
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
    title: "Orkestrate: Multi Agent AI Orchestration Platform",
    description:
      "Orchestrate multiple AI coding agents on a single codebase with zero conflicts. Works with Claude Code, OpenCode, Codex, and any MCP-compatible client.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Orkestrate - Multi Agent AI Orchestration",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@orkestrate",
    creator: "@orkestrate",
    title: "Orkestrate: Multi Agent AI Orchestration Platform",
    description:
      "Orchestrate multiple AI coding agents on a single codebase with zero conflicts.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

import { TooltipProvider } from "@/components/ui/tooltip";
import { headers } from "next/headers";
import { cn } from "@/lib/utils";
import { FeedbackButton } from "@/components/ui/FeedbackButton";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body
        className={`${geist.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased font-sans`}
      >
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
        <FeedbackButton />
      </body>
      <SpeedInsights />
      <Analytics />
    </html>
  );
}
