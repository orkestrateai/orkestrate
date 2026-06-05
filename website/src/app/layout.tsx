import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const siteUrl = "https://orkestrate.space";

export const metadata: Metadata = {
  title: {
    default: "Orkestrate — Specialized harnesses for agents",
    template: "%s · Orkestrate",
  },
  description:
    "Browse, use, and share specialized harnesses. Task-tuned execution for specialized agents — built by you or by the agent.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Orkestrate",
    title: "Orkestrate",
    description:
      "Browse, use, and share specialized harnesses for agent packs on real runtimes.",
    images: [{ url: "/hero.png", width: 1200, height: 630, alt: "Orkestrate" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orkestrate",
    description: "Browse, use, and share specialized harnesses.",
    images: ["/hero.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="bg-surface antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}