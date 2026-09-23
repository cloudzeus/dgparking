import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Σύνδεση — MEGA Parking",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Η σύνδεση είναι η είσοδος των πελατών στο site: κρατά τη μάρκα MEGA
  // Parking. Από το `/dashboard` και μέσα ισχύουν τα tokens του DG.
  return <div className="theme-mega min-h-screen bg-muted/40">{children}</div>;
}
