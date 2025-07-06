import type React from "react";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/lib/auth-context";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata = {
  title: "Real Estate Outreach Automation",
  description:
    "Automate your real estate outreach with AI-powered community data enrichment",
  generator: "v0.dev",
  applicationName: "RealEstate OutReach",
  keywords: ["real estate", "outreach", "automation", "AI", "productivity"],
  authors: [{ name: "Total Body Mobile Massage" }],
  creator: "Total Body Mobile Massage Outreach Team",
  publisher: "Total Body Mobile Massage",
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RE OutReach",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "RE OutReach",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e4d42" },
    { media: "(prefers-color-scheme: dark)", color: "#13241f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${outfit.variable} ${fraunces.variable} font-sans touch-manipulation tap-highlight-none`}
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <Navbar>{children}</Navbar>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
