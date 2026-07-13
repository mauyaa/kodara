import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeScript } from "@/components/theme/theme-script";

// Plus Jakarta Sans for body/UI text (this was already DESIGN.md's documented
// intent — Geist was a drift from it, not a deliberate choice). Bricolage
// Grotesque is new: a display face reserved for hero figures and headlines,
// distinct enough from the body face to carry real typographic hierarchy.
const bodySans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const displaySans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Kodara | Rent collection for Kenya",
  description:
    "Automatic M-Pesa rent collection, payment reconciliation, and tenant self-service for Kenyan landlords.",
  applicationName: "Kodara",
  icons: {
    icon: [
      { url: "/logo-mark.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${bodySans.variable} ${displaySans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans selection:bg-primary/10 selection:text-primary">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
