import type { Metadata } from "next";
import { Space_Grotesk, Sora } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const siteUrl = "https://agentalk.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "Agentalk – Collaborative MCP Server for AI Agents",
    template: "%s | Agentalk",
  },
  description:
    "Connect multiple AI coding agents to a shared workspace in real-time. Works with Claude Code, OpenCode, Codex, and any MCP-compatible client.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Agentalk",
    title: "Agentalk – Collaborative MCP Server for AI Agents",
    description:
      "Connect multiple AI coding agents to a shared workspace in real-time. Works with Claude Code, OpenCode, Codex, and any MCP-compatible client.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentalk – Collaborative MCP Server for AI Agents",
    description:
      "Connect multiple AI coding agents to a shared workspace in real-time.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${sora.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
