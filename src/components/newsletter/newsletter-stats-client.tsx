"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, MousePointerClick, Send, Inbox, MailOpen, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AreaTrendChart,
  BarTrendChart,
  ChartCard,
  DonutChart,
} from "@/components/admin/charts";
import { EmptyState, KpiTile } from "@/components/admin/page";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { StatsFunnel } from "./stats-funnel";
import { StatsCampaignsTable } from "./stats-campaigns-table";
import type { NewsletterStatsView } from "./stats-types";

const numberFormat = new Intl.NumberFormat("el-GR");
const num = (value: number) => numberFormat.format(value);
const percent = (value: number) => `${value.toLocaleString("el-GR")}%`;

const ALL = "all";

/** Ημερομηνία άξονα: 2026-03-14 → 14 Μαρ. */
function dayLabel(value: string | number): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("el-GR", { day: "2-digit", month: "short", timeZone: "Europe/Athens" });
}

/** Κόβει τους συνδέσμους ώστε να χωρούν στον άξονα κατηγοριών. */
function shortUrl(value: string | number): string {
  const raw = String(value);
  try {
    const url = new URL(raw);
    const path = `${url.hostname}${url.pathname}`.replace(/\/$/, "");
    return path.length > 28 ? `${path.slice(0, 27)}…` : path;
  } catch {
    return raw.length > 28 ? `${raw.slice(0, 27)}…` : raw;
  }
}

export function NewsletterStatsClient({ view }: { view: NewsletterStatsView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    totals,
    options,
    campaigns,
    timeline,
    topLinks,
    clients,
    devices,
    geo,
    byHour,
    timeToOpen,
    failures,
    growth,
    mix,
  } = view;

  function selectCampaign(value: string) {
    startTransition(() => {
      router.push(value === ALL ? "/newsletter/stats" : `/newsletter/stats?campaign=${value}`);
    });
  }

  if (options.length === 0) {
    return (
      <EmptyState
        title="Δεν υπάρχει καμία αποστολή ακόμη"
        description="Τα στατιστικά εμφανίζονται μετά την πρώτη αποστολή ενημερωτικού δελτίου."
        icon={Send}
      />
    );
  }

  const outcomeMix = [
    { key: "delivered", label: "Παραδόθηκαν", value: totals.delivered },
    { key: "bounced", label: "Αποτυχίες", value: totals.bounced },
    { key: "complained", label: "Παράπονα", value: totals.complained },
  ].filter((slice) => slice.value > 0);

  const openRateByCampaign = options
    .filter((c) => c.sent > 0)
    .slice(0, 8)
    .map((c) => ({ name: c.name.length > 24 ? `${c.name.slice(0, 23)}…` : c.name, openRate: c.openRate }))
    .reverse();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Στάλθηκαν"
          value={num(totals.sent)}
          hint={`${num(options.length)} αποστολές συνολικά`}
          icon={Send}
          tone="blue"
        />
        <KpiTile
          label="Παραδόθηκαν"
          value={num(totals.delivered)}
          hint={`Ποσοστό παράδοσης ${percent(totals.deliveryRate)}`}
          icon={MailCheck}
          tone="green"
        />
        <KpiTile
          label="Ανοίγματα"
          value={totals.openTracked ? num(totals.openedUnique) : "—"}
          hint={
            totals.openTracked
              ? `Ποσοστό ανοίγματος ${percent(totals.openRate)}`
              : "Δεν μετρήθηκαν"
          }
          icon={MailOpen}
          tone="amber"
        />
        <KpiTile
          label="Κλικ"
          value={totals.openTracked ? num(totals.clickedUnique) : "—"}
          hint={
            totals.openTracked
              ? `Ποσοστό κλικ ${percent(totals.clickRate)} · CTOR ${percent(totals.ctor)}`
              : "Δεν μετρήθηκαν"
          }
          icon={MousePointerClick}
          tone="violet"
        />
      </div>

      {/*
        «Μηδέν ανοίγματα» και «δεν μετρήθηκαν ανοίγματα» είναι δύο τελείως
        διαφορετικά πράγματα. Χωρίς αυτή τη διάκριση η σελίδα έδειχνε 0% και
        διαβαζόταν σαν να μην άνοιξε κανείς το δελτίο.
      */}
      {!totals.openTracked && totals.delivered > 0 && (
        <Alert>
          <Info />
          <AlertTitle>Τα ανοίγματα δεν μετρήθηκαν σε αυτή την αποστολή</AlertTitle>
          <AlertDescription>
            Η παρακολούθηση ήταν κλειστή όταν έφυγε το μήνυμα, οπότε δεν υπάρχει
            καταγραφή — όχι μηδέν αναγνώστες. Είναι πλέον ενεργή και μετράει από την
            επόμενη αποστολή. Για όσα έχουν ήδη σταλεί, τα ανοίγματα δεν ανακτώνται.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="newsletter-campaign">Αποστολή</Label>
            <Select
              value={view.selectedCampaignId ?? ALL}
              onValueChange={selectCampaign}
              disabled={pending}
            >
              <SelectTrigger id="newsletter-campaign" className="w-72">
                <SelectValue placeholder="Όλες οι αποστολές" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Όλες οι αποστολές</SelectItem>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            Τα στατιστικά ενημερώνονται ζωντανά από τα συμβάντα του Mailgun. Με την «Ανανέωση από
            Mailgun» κατεβαίνουν ξανά όσα συμβάντα τυχόν χάθηκαν.
          </p>
        </CardContent>
      </Card>

      {!view.hasEvents ? (
        <EmptyState
          title="Δεν υπάρχουν συμβάντα ακόμη"
          description="Τα στατιστικά (παραδόσεις, ανοίγματα, κλικ) εμφανίζονται μόλις το Mailgun στείλει τα πρώτα συμβάντα της αποστολής."
          icon={Inbox}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard
              title="Πορεία στον χρόνο"
              description="Παραδόσεις, ανοίγματα και κλικ ανά ημέρα."
              className="xl:col-span-2"
            >
              <AreaTrendChart
                data={timeline}
                xKey="date"
                xFormatter={dayLabel}
                series={[
                  { key: "delivered", label: "Παραδόθηκαν" },
                  { key: "opened", label: "Ανοίγματα" },
                  { key: "clicked", label: "Κλικ" },
                ]}
              />
            </ChartCard>

            <StatsFunnel stats={totals} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Ποσοστό ανοίγματος ανά αποστολή"
              description="Σύγκριση των τελευταίων αποστολών."
            >
              <BarTrendChart
                data={openRateByCampaign}
                xKey="name"
                horizontal
                categoryWidth={150}
                yFormatter={(v) => `${v.toLocaleString("el-GR")}%`}
                series={[{ key: "openRate", label: "Ποσοστό ανοίγματος" }]}
              />
            </ChartCard>

            <ChartCard
              title="Έκβαση παράδοσης"
              description="Πώς κατέληξαν τα μηνύματα που στάλθηκαν."
            >
              {outcomeMix.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Δεν υπάρχουν ακόμη στοιχεία παράδοσης.
                </p>
              ) : (
                <DonutChart data={outcomeMix} centerLabel="μηνύματα" />
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Δημοφιλέστεροι σύνδεσμοι"
              description="Οι σύνδεσμοι με τα περισσότερα κλικ."
            >
              {topLinks.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Δεν έχει καταγραφεί κανένα κλικ ακόμη.
                </p>
              ) : (
                <BarTrendChart
                  data={topLinks.map((link) => ({ label: link.label, clicks: link.value }))}
                  xKey="label"
                  horizontal
                  categoryWidth={170}
                  xFormatter={shortUrl}
                  series={[{ key: "clicks", label: "Κλικ" }]}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Προγράμματα email και συσκευές"
              description="Από πού διαβάζονται τα μηνύματα."
            >
              {clients.length === 0 && devices.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Δεν υπάρχουν στοιχεία ανοιγμάτων ακόμη.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DonutChart
                    height={200}
                    data={clients.map((c, i) => ({
                      key: `client-${i}`,
                      label: c.label,
                      value: c.value,
                    }))}
                    centerLabel="προγράμματα"
                  />
                  <BarTrendChart
                    data={devices.map((d) => ({ label: d.label, count: d.value }))}
                    xKey="label"
                    horizontal
                    height={200}
                    categoryWidth={90}
                    series={[{ key: "count", label: "Συσκευές" }]}
                  />
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}


          {/* ── Πότε ανοίγουν ──────────────────────────────────────────── */}
          <ChartCard
            title="Ανοίγματα ανά ώρα"
            description="Πότε διαβάζει το κοινό σας, σε ώρα Ελλάδας. Απαντά πρακτικά στο τι ώρα να φύγει το επόμενο δελτίο."
          >
            {byHour.every((h) => h.opens === 0) ? (
              <EmptyNote />
            ) : (
              <BarTrendChart
                data={byHour.map((h) => ({
                  label: `${String(h.hour).padStart(2, "0")}:00`,
                  opens: h.opens,
                }))}
                xKey="label"
                height={220}
                series={[{ key: "opens", label: "Ανοίγματα" }]}
              />
            )}
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Ταχύτητα ανοίγματος"
              description="Πόσο γρήγορα ανοίγεται ένα δελτίο μετά την παράδοση — δείχνει πόσο νωρίς έχει νόημα να κριθεί μια αποστολή."
            >
              {timeToOpen.every((t) => t.value === 0) ? (
                <EmptyNote />
              ) : (
                <BarTrendChart
                  data={timeToOpen.map((t) => ({ label: t.label, count: t.value }))}
                  xKey="label"
                  horizontal
                  height={220}
                  categoryWidth={100}
                  series={[{ key: "count", label: "Παραλήπτες" }]}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Από πού ανοίγουν"
              description="Οι πόλεις των παραληπτών που άνοιξαν. Όσα ανοίγματα δεν εντοπίζονται γεωγραφικά δεν μετρούνται."
            >
              {geo.length === 0 ? (
                <EmptyNote />
              ) : (
                <BarTrendChart
                  data={geo.map((g) => ({ label: g.label, count: g.value }))}
                  xKey="label"
                  horizontal
                  height={220}
                  categoryWidth={110}
                  series={[{ key: "count", label: "Ανοίγματα" }]}
                />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Η λίστα στον χρόνο"
              description="Νέες εγγραφές και διαγραφές ανά μήνα. Η διαφορά τους είναι η πραγματική ανάπτυξη."
            >
              <AreaTrendChart
                data={growth}
                xKey="month"
                height={220}
                series={[
                  { key: "subscribed", label: "Εγγραφές" },
                  { key: "unsubscribed", label: "Διαγραφές" },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Σύνθεση λίστας"
              description="Πού βρίσκονται σήμερα οι συνδρομητές."
            >
              {mix.length === 0 ? (
                <EmptyNote />
              ) : (
                <DonutChart
                  data={mix.map((m, i) => ({ key: `mix-${i}`, label: m.label, value: m.value }))}
                  centerLabel="συνδρομητές"
                />
              )}
            </ChartCard>
          </div>

          {failures.length > 0 && (
            <ChartCard
              title="Γιατί απέτυχαν"
              description="Η αιτιολογία του παρόχου, όχι απλώς το πλήθος — εκεί φαίνεται αν φταίει η λίστα ή το μήνυμα."
            >
              <BarTrendChart
                data={failures.map((f) => ({ label: f.label, count: f.value }))}
                xKey="label"
                horizontal
                height={Math.max(160, failures.length * 34)}
                categoryWidth={220}
                series={[{ key: "count", label: "Συμβάντα", color: "var(--chart-5)" }]}
              />
            </ChartCard>
          )}

      <StatsCampaignsTable campaigns={campaigns} />
    </div>
  );
}

/** Κενό γράφημα: λέει ΓΙΑΤΙ δεν υπάρχει τίποτα, αντί για άδειο πλαίσιο. */
function EmptyNote() {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      Δεν υπάρχουν ακόμα αρκετά συμβάντα για αυτό το γράφημα.
    </p>
  );
}
