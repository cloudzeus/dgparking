"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, KpiTile } from "@/components/admin/page";
import { Spinner } from "@/components/ui/spinner";
import { approvePortalAccess, rejectPortalAccess } from "@/lib/actions/portal-access";
import { toast } from "sonner";
import { AlertTriangle, Check, Clock, FileText, UserCheck, X } from "lucide-react";

export type AccessRequestDTO = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  afm: string;
  trdr: string | null;
  matchedName: string | null;
  activeContracts: number;
  fullName: string;
  email: string;
  accountActive: boolean;
  requestedAt: string;
  decidedAt: string | null;
  note: string | null;
};

const STATUS = {
  PENDING: { label: "Σε αναμονή", className: "border-chart-3/40 bg-chart-3/10 text-chart-3" },
  APPROVED: { label: "Εγκρίθηκε", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  REJECTED: { label: "Απορρίφθηκε", className: "border-chart-5/40 bg-chart-5/10 text-chart-5" },
} as const;

export function PortalAccessClient({ requests }: { requests: AccessRequestDTO[] }) {
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [trdrEdits, setTrdrEdits] = useState<Record<string, string>>({});

  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      unmatched: requests.filter((r) => r.status === "PENDING" && !r.trdr).length,
    }),
    [requests]
  );

  const visible = tab === "PENDING" ? requests.filter((r) => r.status === "PENDING") : requests;

  const run = (id: string, fn: () => Promise<{ success?: boolean; error?: string }>) => {
    setBusyId(id);
    startTransition(async () => {
      const result = await fn();
      setBusyId(null);
      if (result.error) toast.error(result.error);
      else toast.success("Η απόφαση καταχωρήθηκε και στάλθηκε email στον χρήστη.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <KpiTile label="Σε αναμονή" value={counts.pending} icon={Clock} tone="amber" />
        <KpiTile label="Εγκεκριμένοι" value={counts.approved} icon={UserCheck} tone="green" />
        <KpiTile
          label="Χωρίς αντιστοίχιση"
          value={counts.unmatched}
          hint="Το ΑΦΜ δεν βρέθηκε στους πελάτες"
          icon={AlertTriangle}
          tone="red"
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Αιτήματα</CardTitle>
          <CardDescription>
            Ο λογαριασμός παραμένει ανενεργός μέχρι την έγκριση. Ελέγξτε ότι το πρόσωπο
            εκπροσωπεί πράγματι τον πελάτη — το ΑΦΜ από μόνο του δεν το αποδεικνύει.
          </CardDescription>
          <div className="pt-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="PENDING">Σε αναμονή ({counts.pending})</TabsTrigger>
                <TabsTrigger value="ALL">Όλα ({requests.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="Κανένα αίτημα"
              description={tab === "PENDING" ? "Δεν υπάρχουν αιτήματα σε αναμονή." : "Δεν υπάρχουν αιτήματα."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Χρήστης</TableHead>
                    <TableHead>ΑΦΜ</TableHead>
                    <TableHead>Πελάτης ERP</TableHead>
                    <TableHead className="text-center">Ενεργές συμβάσεις</TableHead>
                    <TableHead>Υποβλήθηκε</TableHead>
                    <TableHead>Κατάσταση</TableHead>
                    <TableHead className="text-right">Ενέργειες</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => {
                    const busy = busyId === r.id && pending;
                    const meta = STATUS[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.fullName}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell className="font-mono">{r.afm}</TableCell>
                        <TableCell>
                          {r.matchedName ? (
                            <>
                              <div className="max-w-56 truncate">{r.matchedName}</div>
                              <div className="text-xs text-muted-foreground">TRDR {r.trdr}</div>
                            </>
                          ) : r.status === "PENDING" ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={trdrEdits[r.id] ?? ""}
                                onChange={(e) =>
                                  setTrdrEdits((s) => ({ ...s, [r.id]: e.target.value }))
                                }
                                placeholder="TRDR πελάτη"
                                className="h-8 w-32 font-mono text-xs"
                              />
                              <span className="text-xs text-chart-5">δεν βρέθηκε</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {r.activeContracts > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="size-3.5 text-muted-foreground" />
                              {r.activeContracts}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {r.requestedAt}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.className}>
                            {meta.label}
                          </Badge>
                          {r.note && (
                            <div className="mt-1 max-w-56 text-xs text-muted-foreground">{r.note}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === "PENDING" ? (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  run(r.id, () => approvePortalAccess(r.id, trdrEdits[r.id]))
                                }
                              >
                                {busy ? <Spinner data-icon="inline-start" /> : <Check />}
                                Έγκριση
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => run(r.id, () => rejectPortalAccess(r.id))}
                              >
                                <X />
                                Απόρριψη
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.decidedAt ?? "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
