"use client";

import { useEffect, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { InfoPanel, InfoRow, StatusBadge } from "@/components/admin/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Key } from "lucide-react";
import { authenticateSoftOne, type SoftOneLoginState } from "@/lib/actions/softone";
import { toast } from "sonner";

export function SoftOneAuthForm() {
  const [state, formAction, isPending] = useActionState<SoftOneLoginState | undefined, FormData>(
    authenticateSoftOne,
    undefined
  );

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
    if (state?.success) {
      toast.success("Η ταυτοποίηση με το SoftOne ολοκληρώθηκε.");
    }
  }, [state]);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Ταυτοποίηση SoftOne</CardTitle>
        <CardDescription>
          Σύνδεση στο SoftOne ERP με τα στοιχεία της εταιρείας.
        </CardDescription>
        {(state?.success || state?.error) && (
          <CardAction>
            <StatusBadge
              variant={state.success ? "success" : "danger"}
              label={state.success ? "Ταυτοποιημένη" : "Σφάλμα"}
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appId">App ID *</Label>
              <Input
                id="appId"
                name="appId"
                type="text"
                defaultValue="1001"
                placeholder="1001"
                required
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">Εταιρεία *</Label>
              <Input
                id="company"
                name="company"
                type="text"
                defaultValue="1002"
                placeholder="1002"
                required
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Χρήστης *</Label>
              <Input
                id="username"
                name="username"
                defaultValue="cronusweb"
                placeholder="cronusweb"
                required
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Κωδικός *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Ο κωδικός του χρήστη"
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex justify-end border-t pt-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Γίνεται ταυτοποίηση…
                </>
              ) : (
                <>
                  <Key aria-hidden />
                  Ταυτοποίηση
                </>
              )}
            </Button>
          </div>
        </form>

        {state?.session && (
          <div className="flex flex-col gap-3">
            <InfoPanel title="Στοιχεία συνεδρίας" accent="bg-chart-2">
              <InfoRow label="Client ID" mono wrap>
                {state.session.clientID}
              </InfoRow>
              {state.session.s1u !== undefined && <InfoRow label="S1U">{state.session.s1u}</InfoRow>}
              {state.session.companyinfo && (
                <InfoRow label="Στοιχεία εταιρείας" wrap>
                  {state.session.companyinfo}
                </InfoRow>
              )}
              <InfoRow label="Κατάσταση">
                <StatusBadge variant="success" label="Ταυτοποιημένη" />
              </InfoRow>
            </InfoPanel>

            {state.response && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground">Πλήρης απάντηση</h3>
                <pre className="max-h-64 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">
                  {JSON.stringify(state.response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {state?.error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Η ταυτοποίηση απέτυχε</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{state.error}</span>
              {state.response && (
                <pre className="max-h-64 w-full overflow-auto rounded-md border bg-background p-3 font-mono text-xs">
                  {JSON.stringify(state.response, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
