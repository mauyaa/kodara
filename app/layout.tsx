import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang="en" className={`h-full antialiased ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground font-sans selection:bg-primary/10 selection:text-primary">
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] -z-10" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
