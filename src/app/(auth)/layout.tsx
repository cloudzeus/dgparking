import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Σύνδεση — Kolleris Parking",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-muted/40">{children}</div>;
}
