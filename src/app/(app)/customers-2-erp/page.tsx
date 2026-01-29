import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2 } from "lucide-react";

export default async function Customers2ERPPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only allow ADMIN role
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CUSTOMERS 2 ERP"
        highlight="ERP"
        subtitle="Manage customer synchronization with ERP systems"
      />

      <Card className="group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <CardHeader className="relative p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
              <Link2 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">CUSTOMERS TO ERP INTEGRATION</CardTitle>
              <p className="text-[9px] text-muted-foreground mt-1">
                Synchronize customer data between the application and ERP systems
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative p-4">
          <div className="space-y-4">
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-4">
              <h3 className="text-[10px] font-bold uppercase text-muted-foreground mb-3">
                INTEGRATION STATUS
              </h3>
              <div className="space-y-2 text-[9px]">
                <p className="text-muted-foreground">
                  This page will allow you to manage customer synchronization with ERP systems.
                </p>
                <p className="text-muted-foreground">
                  Features coming soon:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                  <li>View customer sync status</li>
                  <li>Manual sync trigger</li>
                  <li>Sync history and logs</li>
                  <li>Configure sync mappings</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}










