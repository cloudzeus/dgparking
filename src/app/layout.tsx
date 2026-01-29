import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/** Prevents static prerender of internal routes (_not-found, _global-error) which fail with useContext during build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SMART-PARK — Intelligent Parking Management",
  description: "SMART-PARK: license plate recognition, access control, contracts, and real-time dashboards for parking operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background font-sans">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
