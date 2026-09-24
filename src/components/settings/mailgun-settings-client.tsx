"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { InfoPanel, InfoRow, StatusBadge } from "@/components/admin/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Save, Send } from "lucide-react";
import { toast } from "sonner";
import {
  saveMailgunSettings,
  sendMailgunTest,
  type MailgunFormState,
} from "@/lib/actions/mailgun";

const MASKED = "••••••••";

export type MailgunSettingsData = {
  domain: string;
  region: "eu" | "us";
  fromName: string;
  fromEmail: string;
  recipientEmail: string;
  isActive: boolean;
  hasApiKey: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

export function MailgunSettingsClient({ settings }: { settings: MailgunSettingsData | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [region, setRegion] = useState<"eu" | "us">(settings?.region ?? "eu");
  const [isActive, setIsActive] = useState(settings?.isActive ?? true);

  const [saveState, saveAction, isSaving] = useActionState<MailgunFormState | undefined, FormData>(
    saveMailgunSettings,
    undefined
  );
  const [testState, testAction, isTesting] = useActionState<MailgunFormState | undefined, FormData>(
    sendMailgunTest,
    undefined
  );

  useEffect(() => {
    if (saveState?.success) toast.success(saveState.success);
    if (saveState?.error) toast.error(saveState.error);
  }, [saveState]);

  useEffect(() => {
    if (testState?.success) toast.success(testState.success);
    if (testState?.error) toast.error(testState.error);
  }, [testState]);

  const fieldErrors = { ...saveState?.fieldErrors, ...testState?.fieldErrors };
  const pending = isSaving || isTesting;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          Στοιχεία αποστολής για τα email των φορμών του site (επικοινωνία, αίτημα προσφοράς).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            form="mailgun-form"
            formAction={testAction}
            variant="outline"
            disabled={pending}
          >
            {isTesting ? <Spinner data-icon="inline-start" /> : <Send aria-hidden />}
            Δοκιμαστικό email
          </Button>
          <Button type="submit" form="mailgun-form" disabled={pending}>
            {isSaving ? <Spinner data-icon="inline-start" /> : <Save aria-hidden />}
            Αποθήκευση
          </Button>
        </div>
      </div>

      {settings?.lastTestOk === false && settings.lastTestError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Η τελευταία δοκιμή απέτυχε</AlertTitle>
          <AlertDescription>{settings.lastTestError}</AlertDescription>
        </Alert>
      )}

      <form id="mailgun-form" ref={formRef} action={saveAction} className="space-y-4">
        {/* Οι τιμές των Select/Switch ταξιδεύουν με κρυφά πεδία. */}
        <input type="hidden" name="region" value={region} />
        <input type="hidden" name="isActive" value={String(isActive)} />

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Λογαριασμός Mailgun</CardTitle>
            <CardDescription>
              Ο λογαριασμός είναι Ευρώπης: το κλειδί δουλεύει μόνο με το endpoint
              <code className="mx-1 font-mono text-xs">api.eu.mailgun.net</code>. Με επιλεγμένη την
              Αμερική, το ίδιο κλειδί απαντά 401.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="domain">Domain αποστολής *</Label>
              <Input
                id="domain"
                name="domain"
                defaultValue={settings?.domain ?? ""}
                placeholder="mg.megaparking.gr"
                required
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.domain)}
              />
              {fieldErrors.domain && <p className="text-xs text-destructive">{fieldErrors.domain}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="region">Περιοχή λογαριασμού *</Label>
              <Select value={region} onValueChange={(v) => setRegion(v as "eu" | "us")} disabled={pending}>
                <SelectTrigger id="region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="eu">Ευρώπη — api.eu.mailgun.net</SelectItem>
                    <SelectItem value="us">Αμερική — api.mailgun.net</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="apiKey">Κλειδί API *</Label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                autoComplete="off"
                defaultValue={settings?.hasApiKey ? MASKED : ""}
                placeholder="key-…"
                required
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.apiKey)}
              />
              <p className="text-xs text-muted-foreground">
                {settings?.hasApiKey
                  ? "Είναι αποθηκευμένο κρυπτογραφημένα. Άφησέ το ως έχει για να μην αλλάξει."
                  : "Αποθηκεύεται κρυπτογραφημένα και δεν εμφανίζεται ξανά."}
              </p>
              {fieldErrors.apiKey && <p className="text-xs text-destructive">{fieldErrors.apiKey}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Αποστολέας και παραλήπτης</CardTitle>
            <CardDescription>
              Ο αποστολέας πρέπει να ανήκει στο domain που επαληθεύτηκε στο Mailgun.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fromName">Όνομα αποστολέα *</Label>
              <Input
                id="fromName"
                name="fromName"
                defaultValue={settings?.fromName ?? "MEGA Parking"}
                required
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.fromName)}
              />
              {fieldErrors.fromName && <p className="text-xs text-destructive">{fieldErrors.fromName}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fromEmail">Email αποστολέα *</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                defaultValue={settings?.fromEmail ?? ""}
                placeholder="no-reply@mg.megaparking.gr"
                required
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.fromEmail)}
              />
              {fieldErrors.fromEmail && <p className="text-xs text-destructive">{fieldErrors.fromEmail}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recipientEmail">Παραλήπτης φορμών *</Label>
              <Input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                defaultValue={settings?.recipientEmail ?? ""}
                placeholder="info@megaparking.gr"
                required
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.recipientEmail)}
              />
              <p className="text-xs text-muted-foreground">
                Εδώ φτάνουν τα μηνύματα από τη φόρμα επικοινωνίας και τα αιτήματα προσφοράς.
              </p>
              {fieldErrors.recipientEmail && (
                <p className="text-xs text-destructive">{fieldErrors.recipientEmail}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="testEmail">Διεύθυνση δοκιμής</Label>
              <Input
                id="testEmail"
                name="testEmail"
                type="email"
                placeholder="Αν μείνει κενό, στέλνει στον παραλήπτη"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.testEmail)}
              />
              {fieldErrors.testEmail && <p className="text-xs text-destructive">{fieldErrors.testEmail}</p>}
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={pending}
                aria-label="Ενεργή αποστολή email"
              />
              <Label htmlFor="isActive" className="font-normal">
                Ενεργή αποστολή — όταν είναι κλειστό, οι φόρμες του site δεν στέλνουν email.
              </Label>
            </div>
          </CardContent>
        </Card>
      </form>

      <InfoPanel title="Κατάσταση" accent={settings?.lastTestOk === false ? "bg-chart-5" : "bg-chart-2"}>
        <InfoRow label="Ρυθμίσεις">
          <StatusBadge
            variant={settings ? "success" : "neutral"}
            label={settings ? "Αποθηκευμένες" : "Δεν έχουν οριστεί"}
          />
        </InfoRow>
        <InfoRow label="Αποστολή">
          <StatusBadge
            variant={settings?.isActive ? "success" : "warning"}
            label={settings?.isActive ? "Ενεργή" : "Ανενεργή"}
          />
        </InfoRow>
        <InfoRow label="Endpoint" mono>
          {region === "us" ? "api.mailgun.net" : "api.eu.mailgun.net"}
        </InfoRow>
        <InfoRow label="Τελευταία δοκιμή">{formatDate(settings?.lastTestAt ?? null)}</InfoRow>
        <InfoRow label="Αποτέλεσμα δοκιμής">
          {settings?.lastTestAt ? (
            <StatusBadge
              variant={settings.lastTestOk ? "success" : "danger"}
              label={settings.lastTestOk ? "Επιτυχία" : "Απέτυχε"}
            />
          ) : (
            "—"
          )}
        </InfoRow>
      </InfoPanel>
    </div>
  );
}
