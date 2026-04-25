import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const siteUrl = "https://orkestrate.space";

export const metadata: Metadata = {
  title: {
    default: "Orkestrate — A Memory Agent That Actually Remembers",
    template: "%s | Orkestrate",
  },
  description:
    "Orkestrate is a personal memory agent for long-term AI conversations. It remembers what matters, so you never have to repeat yourself.",
  keywords: [
    "AI memory",
    "personal AI agent",
    "long-term memory",
    "conversation memory",
    "AI companion",
    "memory agent",
  ],
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Orkestrate",
    title: "Orkestrate — A Memory Agent That Actually Remembers",
    description:
      "A personal memory agent for long-term AI conversations. It remembers what matters.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@orkestrate",
    creator: "@orkestrate",
    title: "Orkestrate — A Memory Agent That Actually Remembers",
    description: "A personal memory agent for long-term AI conversations.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} dark`}>
      <body className="antialiased font-sans bg-[#050505] text-[#F2F2F2]">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
