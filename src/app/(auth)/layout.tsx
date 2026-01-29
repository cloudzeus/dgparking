import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication - Kolleris Parking",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient Background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
      
      {/* Decorative elements */}
      <div className="pointer-events-none fixed left-1/4 top-1/4 -z-10 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none fixed bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      
      {children}
    </div>
  );
}











