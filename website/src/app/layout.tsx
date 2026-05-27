import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const siteUrl = "https://orkestrate.space";

export const metadata: Metadata = {
  title: "Orky",
  description: "coding agents drift and so do you. orky keeps both of you on task.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Orky",
    title: "Orky",
    description: "coding agents drift and so do you. orky keeps both of you on task.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Orky" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orky",
    description: "coding agents drift and so do you. orky keeps both of you on task.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/orky.svg",
    apple: "/apple-icon.png",
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
    <html lang="en" className={`${geist.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
