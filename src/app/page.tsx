import { PublicHeader } from "@/components/layout/public-header";
import { HeroSection } from "@/components/sections/hero-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { AboutSection } from "@/components/sections/about-section";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="relative min-h-screen overflow-hidden pt-14">
        {/* Gradient Background */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />

        <HeroSection />
        <FeaturesSection />
        <AboutSection />
      </main>
    </>
  );
}
