import type { Metadata } from "next";
import { Geist_Mono, Inter, Roboto } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/* DG design system: Segoe UI Variable στα Windows, Inter (με ελληνικά) αλλού. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "greek"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* MEGA Parking: η γραμματοσειρά του δημόσιου site. */
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "greek"],
  display: "swap",
});

/** Prevents static prerender of internal routes (_not-found, _global-error) which fail with useContext during build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SMART-PARK — Έξυπνη διαχείριση στάθμευσης",
  description:
    "SMART-PARK: αναγνώριση πινακίδων, έλεγχος πρόσβασης, συμβόλαια και πίνακες ελέγχου σε πραγματικό χρόνο.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Δημόσιες σελίδες: η γλώσσα της διαδρομής (/el, /en, /it).
  // Σελίδες διαχείρισης: δεν έχουν πρόθεμα, οπότε μένει η προεπιλογή (ελληνικά).
  const locale = await getLocale();

  return (
    // Οι μεταβλητές γραμματοσειράς στο <html>: τα tokens (--font-sans) τις
    // διαβάζουν από το :root του dg-theme.css.
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} ${roboto.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
