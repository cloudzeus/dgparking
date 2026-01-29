"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SoftOneIntegrationWizard } from "./softone-integration-wizard";
import { auth } from "@/lib/auth";

/**
 * Example component showing how to use the SoftOneIntegrationWizard
 * 
 * Usage:
 * ```tsx
 * import { SoftOneIntegrationWizardExample } from "@/components/softone/softone-integration-wizard-example";
 * 
 * export default function MyPage() {
 *   return <SoftOneIntegrationWizardExample />;
 * }
 * ```
 */
export function SoftOneIntegrationWizardExample() {
  const [wizardOpen, setWizardOpen] = useState(false);
  // In a real component, get userId from session
  // For this example, we'll need to get it from the server or pass it as prop
  const [userId, setUserId] = useState<string>("");

  // In a real app, you'd get userId from the server component or session
  // Example: const session = await auth(); const userId = session?.user?.id || "";
  // For this example, userId should be passed as a prop or fetched from session

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">SoftOne Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage SoftOne ERP integrations
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Integration
        </Button>
      </div>

      <SoftOneIntegrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        userId={userId}
        onCreated={(integration) => {
          console.log("Integration created:", integration);
          // Refresh your integrations list here
        }}
      />
    </div>
  );
}








