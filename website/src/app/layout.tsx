import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://orkestrate.space";

export const metadata: Metadata = {
  title: {
    default: "Orkestrate — Your AI That Remembers You",
    template: "%s | Orkestrate",
  },
  description:
    "A personal AI assistant that lives on your desktop. Remembers every conversation, learns your preferences, and helps you think better.",
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
    title: "Orkestrate — Your AI That Remembers You",
    description:
      "A personal AI assistant that lives on your desktop. Remembers every conversation and helps you think better.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Orkestrate" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orkestrate — Your AI That Remembers You",
    description: "A personal AI assistant that lives on your desktop.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
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
        className={`${geist.variable} ${fraunces.variable} antialiased font-sans`}
      >
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
        <FeedbackButton />
      </body>
      <SpeedInsights />
      <Analytics />
    </html>
  );
}
