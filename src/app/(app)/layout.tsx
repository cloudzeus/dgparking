import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
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
      <AppSidebar user={session.user} />
      <SidebarInset className="min-w-0">
        <AppHeader user={session.user} isSoftOneConnected={isSoftOneConnected} />
        {/* Το κέλυφος δίνει το padding — οι σελίδες δεν βάζουν δικό τους. */}
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

