import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SoftOneAuthForm } from "@/components/softone/softone-auth-form";
import { PageHeader, InfoPanel, InfoRow, StatusBadge } from "@/components/admin/page";
import { getSoftOneCredentials, testSoftOneAuthentication } from "@/lib/actions/softone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Database } from "lucide-react";

const NOT_CONFIGURED = "Δεν έχει οριστεί";

export default async function SoftOnePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only allow ADMIN and MANAGER roles
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const credentials = await getSoftOneCredentials();
  const testAuth = await testSoftOneAuthentication();

  return (
    <div className="space-y-4">
      <PageHeader
        title="SoftOne ERP"
        description="Στοιχεία σύνδεσης και έλεγχος ταυτοποίησης με το SoftOne."
        icon={Database}
      />

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <InfoPanel title="Ρυθμίσεις σύνδεσης">
          <InfoRow label="Εταιρεία">{credentials.company || NOT_CONFIGURED}</InfoRow>
          <InfoRow label="Χρήστης">{credentials.username || NOT_CONFIGURED}</InfoRow>
          <InfoRow label="App ID" mono>
            {credentials.appId || NOT_CONFIGURED}
          </InfoRow>
          <InfoRow label="Κωδικός">
            {credentials.password ? "Έχει οριστεί" : NOT_CONFIGURED}
          </InfoRow>
          <InfoRow label="Διεύθυνση API" mono wrap>
            {credentials.apiUrl || NOT_CONFIGURED}
          </InfoRow>
        </InfoPanel>

        <InfoPanel title="Κατάσταση συνεδρίας" accent="bg-chart-2">
          <InfoRow label="Ταυτοποίηση">
            <StatusBadge
              variant={credentials.hasClientID ? "success" : "neutral"}
              label={credentials.hasClientID ? "Ταυτοποιημένη" : "Χωρίς ταυτοποίηση"}
            />
          </InfoRow>
          {credentials.clientID && (
            <InfoRow label="Client ID" mono wrap>
              {credentials.clientID}
            </InfoRow>
          )}
        </InfoPanel>
      </div>

      {testAuth && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Έλεγχος ταυτοποίησης</CardTitle>
            <CardDescription>
              Απάντηση του SoftOne στην τελευταία δοκιμή σύνδεσης.
            </CardDescription>
            <CardAction>
              <StatusBadge
                variant={testAuth.success ? "success" : "danger"}
                label={testAuth.success ? "Επιτυχία" : "Απέτυχε"}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {testAuth.error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Σφάλμα</AlertTitle>
                <AlertDescription>{testAuth.error}</AlertDescription>
              </Alert>
            )}
            {testAuth.response && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground">Δεδομένα απάντησης</h3>
                <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">
                  {JSON.stringify(testAuth.response, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <SoftOneAuthForm />
    </div>
  );
}
