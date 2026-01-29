import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kolleris Parking App",
  description: "Next.js 16 boilerplate with Tailwind CSS 4.1, Prisma, shadcn/ui, and GSAP",
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
