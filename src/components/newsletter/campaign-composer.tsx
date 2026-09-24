"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
  Mail,
  Save,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/admin/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { RichTextEditor } from "@/components/newsletter/rich-text-editor";
import {
  NEWSLETTER_TEMPLATES,
  NEWSLETTER_TEMPLATE_LIST,
  isNewsletterTemplateId,
  renderNewsletter,
  type NewsletterTemplateId,
} from "@/emails/newsletters";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT } from "@/lib/newsletter";
import {
  saveCampaign,
  sendCampaign,
  sendTestNewsletter,
  type NewsletterFormState,
} from "@/lib/actions/newsletter";

export type CampaignDraft = {
  id: string | null;
  name: string;
  subject: string;
  preheader: string;
  template: string;
  locale: "el" | "en";
  contentHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  heroImageUrl: string;
  status: string;
  sentAt: string | null;
  totalRecipients: number;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

export function CampaignComposer({
  campaign,
  subscriberCount,
  previewUnsubscribeUrl,
}: {
  campaign: CampaignDraft;
  subscriberCount: number;
  previewUnsubscribeUrl: string;
}) {
  const router = useRouter();
  const heroInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(campaign.subject);
  const [preheader, setPreheader] = useState(campaign.preheader);
  const [template, setTemplate] = useState<NewsletterTemplateId>(
    isNewsletterTemplateId(campaign.template) ? campaign.template : "announcement",
  );
  const [locale, setLocale] = useState<"el" | "en">(campaign.locale);
  const [contentHtml, setContentHtml] = useState(campaign.contentHtml || "<p></p>");
  const [ctaLabel, setCtaLabel] = useState(campaign.ctaLabel);
  const [ctaUrl, setCtaUrl] = useState(campaign.ctaUrl);
  const [heroImageUrl, setHeroImageUrl] = useState(campaign.heroImageUrl);
  const [heroUploading, setHeroUploading] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const [saveState, saveAction, isSaving] = useActionState<NewsletterFormState | undefined, FormData>(
    saveCampaign,
    undefined,
  );
  const [testState, testAction, isTesting] = useActionState<NewsletterFormState | undefined, FormData>(
    sendTestNewsletter,
    undefined,
  );
  const [sendState, sendAction, isSending] = useActionState<NewsletterFormState | undefined, FormData>(
    sendCampaign,
    undefined,
  );

  useEffect(() => {
    if (saveState?.success) toast.success(saveState.success);
    if (saveState?.error) toast.error(saveState.error);
    if (saveState?.campaignId && !campaign.id) router.replace(`/newsletter/${saveState.campaignId}`);
  }, [saveState, campaign.id, router]);

  useEffect(() => {
    if (testState?.success) toast.success(testState.success);
    if (testState?.error) toast.error(testState.error);
  }, [testState]);

  useEffect(() => {
    if (sendState?.success) {
      toast.success(sendState.success);
      router.refresh();
    }
    if (sendState?.error) toast.error(sendState.error);
  }, [sendState, router]);

  const meta = NEWSLETTER_TEMPLATES[template];
  const pending = isSaving || isTesting || isSending;
  const isSent = campaign.status === "SENT" || campaign.status === "SENDING";

  const previewHtml = useMemo(
    () =>
      renderNewsletter(template, {
        title: subject || "Θέμα δελτίου",
        preheader,
        contentHtml,
        ctaLabel,
        ctaUrl,
        heroImageUrl,
        unsubscribeUrl: previewUnsubscribeUrl,
      }),
    [template, subject, preheader, contentHtml, ctaLabel, ctaUrl, heroImageUrl, previewUnsubscribeUrl],
  );

  const fieldErrors = { ...saveState?.fieldErrors, ...testState?.fieldErrors };

  async function uploadHero(file: File) {
    setHeroUploading(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/newsletter/upload-image", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Το ανέβασμα απέτυχε.");
        return;
      }
      setHeroImageUrl(data.url);
      toast.success("Η εικόνα ανέβηκε.");
    } catch {
      toast.error("Το ανέβασμα απέτυχε.");
    } finally {
      setHeroUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={campaign.id ? "Επεξεργασία εκστρατείας" : "Νέα εκστρατεία"}
        description="Θέμα, πρότυπο και περιεχόμενο. Η προεπισκόπηση δείχνει ακριβώς ό,τι θα φτάσει στο inbox."
        icon={Mail}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href="/newsletter">
                <ArrowLeft aria-hidden />
                Πίσω στη λίστα
              </Link>
            </Button>
            <Button
              type="submit"
              form="campaign-form"
              formAction={testAction}
              variant="outline"
              disabled={pending}
            >
              {isTesting ? <Spinner data-icon="inline-start" /> : <Send aria-hidden />}
              Δοκιμαστική αποστολή
            </Button>
            <Button type="submit" form="campaign-form" disabled={pending || isSent}>
              {isSaving ? <Spinner data-icon="inline-start" /> : <Save aria-hidden />}
              Αποθήκευση προχείρου
            </Button>
          </>
        }
      />

      {isSent && (
        <Alert>
          <AlertCircle />
          <AlertTitle>Η εκστρατεία έχει ήδη σταλεί</AlertTitle>
          <AlertDescription>
            Στάλθηκε {formatDate(campaign.sentAt)} σε {campaign.totalRecipients.toLocaleString("el-GR")}{" "}
            παραλήπτες. Δεν αλλάζει πια — δημιούργησε νέα εκστρατεία για διορθώσεις.
          </AlertDescription>
        </Alert>
      )}

      <form id="campaign-form" action={saveAction} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <input type="hidden" name="id" value={campaign.id ?? ""} />
        <input type="hidden" name="template" value={template} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="contentHtml" value={contentHtml} />
        <input type="hidden" name="heroImageUrl" value={heroImageUrl} />

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Στοιχεία δελτίου</span>
                <StatusBadge
                  variant={CAMPAIGN_STATUS_VARIANT[campaign.status] ?? "neutral"}
                  label={CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status}
                />
              </CardTitle>
              <CardDescription>
                Το θέμα μπαίνει και ως τίτλος στη μπλε κεφαλίδα του email.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="name">Όνομα εκστρατείας *</Label>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Π.χ. Προσφορά Οκτωβρίου"
                  required
                  disabled={pending || isSent}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                <p className="text-xs text-muted-foreground">Εσωτερικό όνομα — δεν το βλέπει ο παραλήπτης.</p>
                {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="subject">Θέμα *</Label>
                <Input
                  id="subject"
                  name="subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Έως έξι λέξεις"
                  required
                  disabled={pending || isSent}
                  aria-invalid={Boolean(fieldErrors.subject)}
                />
                {fieldErrors.subject && <p className="text-xs text-destructive">{fieldErrors.subject}</p>}
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="preheader">Προεπισκόπηση inbox</Label>
                <Input
                  id="preheader"
                  name="preheader"
                  value={preheader}
                  onChange={(event) => setPreheader(event.target.value)}
                  placeholder="Η μία γραμμή που φαίνεται δίπλα στο θέμα"
                  disabled={pending || isSent}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-select">Πρότυπο *</Label>
                <Select
                  value={template}
                  onValueChange={(value) => setTemplate(value as NewsletterTemplateId)}
                  disabled={pending || isSent}
                >
                  <SelectTrigger id="template-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {NEWSLETTER_TEMPLATE_LIST.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="locale-select">Γλώσσα</Label>
                <Select
                  value={locale}
                  onValueChange={(value) => setLocale(value as "el" | "en")}
                  disabled={pending || isSent}
                >
                  <SelectTrigger id="locale-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="el">Ελληνικά</SelectItem>
                      <SelectItem value="en">Αγγλικά</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ctaLabel">Κείμενο κουμπιού</Label>
                <Input
                  id="ctaLabel"
                  name="ctaLabel"
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  placeholder="Π.χ. Δες τις τιμές"
                  disabled={pending || isSent}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ctaUrl">Σύνδεσμος κουμπιού</Label>
                <Input
                  id="ctaUrl"
                  name="ctaUrl"
                  type="url"
                  value={ctaUrl}
                  onChange={(event) => setCtaUrl(event.target.value)}
                  placeholder="https://megaparking.gr/prices"
                  disabled={pending || isSent}
                />
                <p className="text-xs text-muted-foreground">
                  Το κουμπί εμφανίζεται μόνο όταν συμπληρωθούν και τα δύο πεδία.
                </p>
              </div>

              {meta.usesHero && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="heroImage">Κεντρική εικόνα</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="heroImage"
                      value={heroImageUrl}
                      onChange={(event) => setHeroImageUrl(event.target.value)}
                      placeholder="https://…"
                      disabled={pending || isSent}
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => heroInputRef.current?.click()}
                      disabled={pending || isSent || heroUploading}
                    >
                      {heroUploading ? <Spinner data-icon="inline-start" /> : <ImageIcon aria-hidden />}
                      Ανέβασμα
                    </Button>
                    {heroImageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setHeroImageUrl("")}
                        disabled={pending || isSent}
                      >
                        Αφαίρεση
                      </Button>
                    )}
                  </div>
                  <input
                    ref={heroInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadHero(file);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Περιεχόμενο</CardTitle>
              <CardDescription>
                {meta.usesBlocks
                  ? "Το πρότυπο χωρίζει το κείμενο σε ενότητες στις διαχωριστικές γραμμές."
                  : "Ένα ενιαίο κείμενο — το πρότυπο δεν χρησιμοποιεί ενότητες."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor value={contentHtml} onChange={setContentHtml} disabled={pending || isSent} />
              {fieldErrors.contentHtml && (
                <p className="mt-2 text-xs text-destructive">{fieldErrors.contentHtml}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Δοκιμή και αποστολή</CardTitle>
              <CardDescription>
                Στείλε πρώτα δοκιμαστικά στον εαυτό σου. Η κανονική αποστολή πηγαίνει σε{" "}
                {subscriberCount.toLocaleString("el-GR")} εγγεγραμμένους συνδρομητές.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="testEmail">Διεύθυνση δοκιμής</Label>
                <Input
                  id="testEmail"
                  name="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  placeholder="email@megaparking.gr"
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors.testEmail)}
                />
                {fieldErrors.testEmail && <p className="text-xs text-destructive">{fieldErrors.testEmail}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || isSent || !campaign.id || subscriberCount === 0}
                    >
                      {isSending ? <Spinner data-icon="inline-start" /> : <Users aria-hidden />}
                      Αποστολή σε όλους
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Αποστολή του δελτίου;</AlertDialogTitle>
                      <AlertDialogDescription>
                        Θα σταλεί σε {subscriberCount.toLocaleString("el-GR")} εγγεγραμμένους συνδρομητές.
                        Η ενέργεια δεν αναιρείται. Αποθήκευσε πρώτα τις τελευταίες αλλαγές σου.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <button type="submit" form="send-campaign-form">
                          Αποστολή τώρα
                        </button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {!campaign.id && (
                  <span className="text-xs text-muted-foreground">
                    Αποθήκευσε πρώτα το πρόχειρο για να ενεργοποιηθεί η αποστολή.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          <Card className="xl:sticky xl:top-4">
            <CardHeader className="border-b">
              <CardTitle>Προεπισκόπηση</CardTitle>
              <CardDescription>
                Πρότυπο «{meta.label}». Ο σύνδεσμος διαγραφής μπαίνει αυτόματα σε κάθε δελτίο.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <iframe
                title="Προεπισκόπηση δελτίου"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[720px] w-full rounded-md border bg-white"
              />
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Ξεχωριστή φόρμα: η αποστολή στέλνει μόνο το id, χωρίς τα πεδία του προχείρου. */}
      <form id="send-campaign-form" action={sendAction} className="hidden">
        <input type="hidden" name="id" value={campaign.id ?? ""} />
      </form>
    </div>
  );
}
