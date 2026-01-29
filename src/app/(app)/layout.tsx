import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { getSoftOneClientId } from "@/lib/softone-api";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Check if SoftOne is connected
  const softOneClientId = await getSoftOneClientId();
  const isSoftOneConnected = !!softOneClientId;

  return (
    <SidebarProvider>
      {/* Gradient Background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />

      <AppSidebar user={session.user} />
      <SidebarInset>
        <AppHeader user={session.user} isSoftOneConnected={isSoftOneConnected} />
        <main className="flex-1 relative p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

