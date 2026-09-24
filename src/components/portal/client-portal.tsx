"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortalGateBook } from "@/lib/portal-gatebook";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/admin/page";
import {
  requestAddPlate,
  requestRemovePlate,
  requestRenewal,
  cancelRequest,
} from "@/lib/actions/portal-requests";
import { toast } from "sonner";
import {
  AlertCircle,
  Car,
  CalendarClock,
  Check,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export type ContractDTO = {
  inst: number;
  name: string | null;
  slots: number | null;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  daysLeft: number | null;
  plates: string[];
  carsInside: number;
  /** Η περίοδος της ΝΕΑΣ σύμβασης που θα δημιουργηθεί αν ζητηθεί ανανέωση. */
  nextPeriod: string;
  nextName: string;
};

export type InvoiceDTO = { code: string; date: string; amount: number; url: string | null };

export type RequestDTO = {
  id: string;
  inst: number;
  type: "ADD_PLATE" | "REMOVE_PLATE" | "RENEW";
  plate: string | null;
  slots: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED" | "FAILED";
  createdAt: string;
  error: string | null;
};

const REQUEST_LABEL = {
  ADD_PLATE: "Προσθήκη πινακίδας",
  REMOVE_PLATE: "Αφαίρεση πινακίδας",
  RENEW: "Νέα σύμβαση (ανανέωση)",
} as const;

const STATUS_META = {
  PENDING: { label: "Σε αναμονή", className: "border-chart-3/40 bg-chart-3/10 text-chart-3" },
  APPROVED: { label: "Εγκρίθηκε", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  APPLIED: { label: "Ολοκληρώθηκε", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  REJECTED: { label: "Απορρίφθηκε", className: "border-chart-5/40 bg-chart-5/10 text-chart-5" },
  FAILED: { label: "Απέτυχε", className: "border-chart-5/40 bg-chart-5/10 text-chart-5" },
} as const;

/** Πόσες ημέρες πριν τη λήξη εμφανίζεται προειδοποίηση. */
const WARN_DAYS = 7;

export function ClientPortal({
  customerName,
  afm,
  contracts,
  invoices,
  invoiceError,
  requests,
  gateBook,
  readOnly = false,
}: {
  customerName: string;
  afm: string | null;
  contracts: ContractDTO[];
  invoices: InvoiceDTO[];
  invoiceError: string | null;
  requests: RequestDTO[];
  /** Οι κινήσεις των οχημάτων του πελάτη — μόνο ανάγνωση. */
  gateBook: PortalGateBook;
  /** Προεπισκόπηση: όλα φαίνονται, τίποτα δεν εκτελείται. */
  readOnly?: boolean;
}) {
  const active = contracts.filter((c) => c.isActive);
  const expiring = active.filter((c) => c.daysLeft !== null && c.daysLeft <= WARN_DAYS);
  const [pending, startTransition] = useTransition();
  const [newPlate, setNewPlate] = useState<Record<number, string>>({});
  const [renewSlots, setRenewSlots] = useState<Record<number, string>>({});

  const run = (fn: () => Promise<{ success?: boolean; error?: string }>, okMessage: string) => {
    if (readOnly) {
      toast.info("Προεπισκόπηση — καμία ενέργεια δεν εκτελείται.");
      return;
    }
    return startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else toast.success(okMessage);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{customerName}</h1>
        {afm && <p className="text-sm text-muted-foreground">ΑΦΜ {afm}</p>}
      </div>

      {expiring.map((c) => (
        <Alert key={`warn-${c.inst}`} variant="destructive">
          <CalendarClock />
          <AlertTitle>
            {c.daysLeft !== null && c.daysLeft <= 0
              ? "Η σύμβασή σας λήγει σήμερα"
              : `Η σύμβασή σας λήγει σε ${c.daysLeft} ημέρες`}
          </AlertTitle>
          <AlertDescription>
            Σύμβαση {c.inst} · λήξη {c.endsOn}. Ζητήστε ανανέωση από την καρτέλα «Σύμβαση»
            για να μη διακοπεί η πρόσβαση των οχημάτων σας.
          </AlertDescription>
        </Alert>
      ))}

      <Tabs defaultValue="contract">
        <TabsList>
          <TabsTrigger value="contract">Σύμβαση</TabsTrigger>
          <TabsTrigger value="plates">Πινακίδες</TabsTrigger>
          <TabsTrigger value="movements">Κινήσεις</TabsTrigger>
          <TabsTrigger value="invoices">Τιμολόγια</TabsTrigger>
          {requests.length > 0 && <TabsTrigger value="requests">Αιτήματα</TabsTrigger>}
        </TabsList>

        <TabsContent value="contract" className="mt-3 space-y-3">
          {active.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Καμία ενεργή σύμβαση"
              description="Δεν βρέθηκε ενεργή σύμβαση. Επικοινωνήστε μαζί μας για ανανέωση."
            />
          ) : (
            active.map((c) => (
              <Card key={c.inst}>
                <CardHeader className="border-b">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    Σύμβαση {c.inst}
                    <Badge variant="outline" className="border-chart-2/40 bg-chart-2/10 text-chart-2">
                      Ενεργή
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {c.startsOn} — {c.endsOn}
                    {c.daysLeft !== null && ` · απομένουν ${c.daysLeft} ημέρες`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Stat label="Θέσεις" value={c.slots ?? "—"} />
                    <Stat label="Δηλωμένες πινακίδες" value={c.plates.length} />
                    <Stat label="Οχήματα μέσα τώρα" value={c.carsInside} />
                  </div>

                  {c.slots !== null && c.carsInside > c.slots && (
                    <Alert>
                      <AlertCircle />
                      <AlertTitle>Υπέρβαση θέσεων</AlertTitle>
                      <AlertDescription>
                        Αυτή τη στιγμή βρίσκονται μέσα {c.carsInside} οχήματα ενώ έχετε {c.slots}{" "}
                        θέσεις. Τα επιπλέον χρεώνονται με την κανονική τιμή επισκέπτη.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      Η ανανέωση δημιουργεί <strong className="text-foreground">νέα σύμβαση</strong> για
                      την επόμενη περίοδο, με αντιγραφή των {c.plates.length} πινακίδων σας:
                    </p>
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="font-medium">{c.nextName}</div>
                      <div className="tabular-nums text-muted-foreground">{c.nextPeriod}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`slots-${c.inst}`}>Θέσεις νέας σύμβασης</Label>
                      <Input
                        id={`slots-${c.inst}`}
                        type="number"
                        min={1}
                        max={200}
                        className="w-32"
                        placeholder={String(c.slots ?? 1)}
                        value={renewSlots[c.inst] ?? ""}
                        onChange={(e) =>
                          setRenewSlots((s) => ({ ...s, [c.inst]: e.target.value }))
                        }
                        disabled={pending}
                      />
                    </div>
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => requestRenewal(c.inst, Number(renewSlots[c.inst] ?? c.slots ?? 1)),
                          "Το αίτημα ανανέωσης καταχωρήθηκε."
                        )
                      }
                    >
                      {pending ? <Spinner data-icon="inline-start" /> : <CalendarClock />}
                      Αίτημα νέας σύμβασης
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="plates" className="mt-3 space-y-3">
          {active.map((c) => (
            <Card key={`plates-${c.inst}`}>
              <CardHeader className="border-b">
                <CardTitle>Πινακίδες σύμβασης {c.inst}</CardTitle>
                <CardDescription>
                  Μπορείτε να δηλώσετε όσες πινακίδες θέλετε. Η χρέωση αφορά πόσα οχήματα
                  βρίσκονται ταυτόχρονα μέσα, όχι πόσα είναι δηλωμένα.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-wrap gap-2">
                  {c.plates.length === 0 && (
                    <span className="text-sm text-muted-foreground">Καμία δηλωμένη πινακίδα.</span>
                  )}
                  {c.plates.map((plate) => (
                    <span
                      key={plate}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm"
                    >
                      <Car className="size-3.5 text-muted-foreground" />
                      {plate}
                      <button
                        type="button"
                        aria-label={`Αφαίρεση ${plate}`}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => requestRemovePlate(c.inst, plate),
                            `Το αίτημα αφαίρεσης για ${plate} καταχωρήθηκε.`
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-end gap-2 border-t pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`plate-${c.inst}`}>Νέα πινακίδα</Label>
                    <Input
                      id={`plate-${c.inst}`}
                      className="w-44 font-mono uppercase"
                      placeholder="π.χ. ΙΚΑ4707"
                      maxLength={12}
                      value={newPlate[c.inst] ?? ""}
                      onChange={(e) => setNewPlate((s) => ({ ...s, [c.inst]: e.target.value }))}
                      disabled={pending}
                    />
                  </div>
                  <Button
                    disabled={pending || !(newPlate[c.inst] ?? "").trim()}
                    onClick={() => {
                      run(() => requestAddPlate(c.inst, newPlate[c.inst] ?? ""), "Το αίτημα καταχωρήθηκε.");
                      setNewPlate((s) => ({ ...s, [c.inst]: "" }));
                    }}
                  >
                    {pending ? <Spinner data-icon="inline-start" /> : <Plus />}
                    Αίτημα προσθήκης
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Οι αλλαγές ισχύουν μόλις τις εγκρίνει το προσωπικό μας.
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="movements" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex flex-wrap items-center gap-2">
                Οχήματα στον χώρο
                {gateBook.insideCount > 0 && (
                  <Badge variant="outline" className="border-chart-2/40 bg-chart-2/10 text-chart-2">
                    {gateBook.insideCount} μέσα
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Τι βρίσκεται αυτή τη στιγμή στο πάρκινγκ, από τις κάμερες εισόδου και εξόδου.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {gateBook.inside.length === 0 ? (
                <EmptyState
                  icon={Car}
                  title="Κανένα όχημα μέσα"
                  description="Αυτή τη στιγμή δεν βρίσκεται κανένα από τα οχήματά σας στον χώρο."
                />
              ) : (
                <div className="divide-y">
                  {gateBook.inside.map((m) => (
                    <div
                      key={`in-${m.plate}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <span className="font-mono font-medium">{m.plate}</span>
                      <span className="text-sm text-muted-foreground">
                        Είσοδος {m.entry} · {m.duration}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Πρόσφατες κινήσεις</CardTitle>
              <CardDescription>Οι σταθμεύσεις των οχημάτων σας τον τελευταίο μήνα.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {gateBook.history.length === 0 ? (
                <EmptyState
                  icon={Car}
                  title="Καμία κίνηση"
                  description="Δεν καταγράφηκε στάθμευση των οχημάτων σας τον τελευταίο μήνα."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Πινακίδα</TableHead>
                        <TableHead>Είσοδος</TableHead>
                        <TableHead>Έξοδος</TableHead>
                        <TableHead>Παραμονή</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gateBook.history.map((m, i) => (
                        <TableRow key={`h-${m.plate}-${i}`}>
                          <TableCell className="font-mono font-medium">{m.plate}</TableCell>
                          <TableCell className="whitespace-nowrap">{m.entry}</TableCell>
                          <TableCell className="whitespace-nowrap">{m.exit}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {m.duration}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Τιμολόγια τελευταίου 12μήνου</CardTitle>
              <CardDescription>
                Τα παραστατικά ανοίγουν στη σελίδα του παρόχου ηλεκτρονικής τιμολόγησης,
                από όπου μπορείτε να τα εκτυπώσετε ή να τα αποθηκεύσετε.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {invoiceError ? (
                <div className="p-4">
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Τα τιμολόγια δεν φορτώθηκαν</AlertTitle>
                    <AlertDescription>Δοκιμάστε ξανά σε λίγο.</AlertDescription>
                  </Alert>
                </div>
              ) : invoices.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Κανένα τιμολόγιο"
                  description="Δεν βρέθηκαν τιμολόγια για τους τελευταίους 12 μήνες."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Παραστατικό</TableHead>
                      <TableHead>Ημερομηνία</TableHead>
                      <TableHead className="text-right">Ποσό</TableHead>
                      <TableHead className="text-right">Παραστατικό</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((i) => (
                      <TableRow key={i.code}>
                        <TableCell className="font-mono">{i.code}</TableCell>
                        <TableCell>{i.date}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {i.amount.toFixed(2)} €
                        </TableCell>
                        <TableCell className="text-right">
                          {i.url ? (
                            <a
                              href={i.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                            >
                              Άνοιγμα
                              <ExternalLink className="size-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">μη διαθέσιμο</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Τα αιτήματά σας</CardTitle>
              <CardDescription>Όσα δεν έχουν κριθεί μπορείτε να τα ανακαλέσετε.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Αίτημα</TableHead>
                    <TableHead>Σύμβαση</TableHead>
                    <TableHead>Υποβλήθηκε</TableHead>
                    <TableHead>Κατάσταση</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          {REQUEST_LABEL[r.type]}
                          {r.plate && <span className="ml-1.5 font-mono text-sm">{r.plate}</span>}
                          {r.slots != null && (
                            <span className="ml-1.5 text-sm">{r.slots} θέσεις</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{r.inst}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {r.createdAt}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.className}>
                            {r.status === "APPLIED" ? <Check className="size-3" /> : null}
                            {meta.label}
                          </Badge>
                          {r.error && (
                            <div className="mt-1 max-w-64 text-xs text-destructive">{r.error}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() =>
                                run(() => cancelRequest(r.id), "Το αίτημα ανακλήθηκε.")
                              }
                            >
                              <X />
                              Ανάκληση
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
