import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SoftOneAuthForm } from "@/components/softone/softone-auth-form";
import { PageHeader } from "@/components/ui/page-header";
import { getSoftOneCredentials, testSoftOneAuthentication } from "@/lib/actions/softone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Terminal } from "lucide-react";

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
    <div className="space-y-6">
      <PageHeader
        title="SOFTONE ERP"
        highlight="ERP"
        subtitle="Authenticate and connect to SoftOne ERP system"
      />

      {/* Environment Variables Status */}
      <div className="rounded-lg border border-muted-foreground/20 bg-card/50 p-4">
        <h3 className="text-[10px] font-bold uppercase text-muted-foreground mb-3">
          CONFIGURATION STATUS
        </h3>
        <div className="grid grid-cols-2 gap-3 text-[9px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Company:</span>
            <span className="font-medium">
              {credentials.company || "Not configured"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Username:</span>
            <span className="font-medium">
              {credentials.username || "Not configured"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">App ID:</span>
            <span className="font-medium">
              {credentials.appId || "Not configured"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Password:</span>
            <span className="font-medium">
              {credentials.password ? "✓ Configured" : "Not configured"}
            </span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-muted-foreground">API URL:</span>
            <span className="font-medium text-[8px] break-all">
              {credentials.apiUrl || "Not configured"}
            </span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-muted-foreground">Client ID Status:</span>
            <span className="font-medium">
              {credentials.hasClientID ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[8px] font-bold">
                  ✓ AUTHENTICATED
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] font-bold">
                  NOT AUTHENTICATED
                </Badge>
              )}
            </span>
          </div>
          {credentials.clientID && (
            <div className="flex flex-col col-span-2">
              <span className="text-muted-foreground mb-1">Client ID (partial):</span>
              <span className="font-mono text-[8px] break-all">{credentials.clientID}</span>
            </div>
          )}
        </div>
      </div>

      {/* Authentication Test Result */}
      {testAuth && (
        <Card className="group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="relative p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
                  <Terminal className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">AUTHENTICATION TEST RESULT</CardTitle>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    Response from SoftOne ERP authentication (check console for full details)
                  </p>
                </div>
              </div>
              {testAuth.success ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[8px] font-bold">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SUCCESS
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[8px] font-bold">
                  <XCircle className="h-3 w-3 mr-1" />
                  FAILED
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="relative p-4">
            {testAuth.error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-[9px] font-medium text-destructive mb-1">Error:</p>
                <p className="text-[9px] text-destructive">{testAuth.error}</p>
              </div>
            )}
            {testAuth.response && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground">
                  RESPONSE DATA
                </h4>
                <pre className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/20 overflow-x-auto text-[8px] font-mono">
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

