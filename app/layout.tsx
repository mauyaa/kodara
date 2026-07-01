import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { KodaraProvider } from "@/lib/KodaraContext";

export const metadata: Metadata = {
  title: "Kodara | Property operations, under control",
  description:
    "The Kenyan property management operating system for rent collection, tenant self-service, maintenance, documents, and reporting.",
  applicationName: "Kodara",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text-primary)] font-sans"
        suppressHydrationWarning
      >
        <KodaraProvider>{children}</KodaraProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
