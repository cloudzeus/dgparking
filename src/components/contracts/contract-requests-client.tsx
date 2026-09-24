"use client";

import { useState, useTransition } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, KpiTile } from "@/components/admin/page";
import { approveRequest, rejectRequest, markApplied } from "@/lib/actions/contract-requests";
import { toast } from "sonner";
import { Check, ClipboardCheck, Clock, Inbox, LayoutGrid, X } from "lucide-react";

export type ChangeRequestDTO = {
  id: string;
  inst: number;
  type: "ADD_PLATE" | "REMOVE_PLATE" | "RENEW";
  plate: string | null;
  slots: number | null;
  newPeriod: string | null;
  newName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED" | "FAILED";
  createdAt: string;
  requester: string;
  error: string | null;
  note: string | null;
  /** Πόσες κενές γραμμές έχει η σύμβαση — εκεί θα μπει η πινακίδα. */
  emptyLines: number;
};

export type CapacityDTO = {
  inst: number;
  name: string | null;
  slots: number | null;
  filled: number;
  empty: number;
};

const TYPE_LABEL = {
  ADD_PLATE: "Προσθήκη πινακίδας",
  REMOVE_PLATE: "Αφαίρεση πινακίδας",
  RENEW: "Νέα σύμβαση",
} as const;

const STATUS = {
  PENDING: { label: "Σε αναμονή", className: "border-chart-3/40 bg-chart-3/10 text-chart-3" },
  APPROVED: { label: "Εγκρίθηκε", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  APPLIED: { label: "Ολοκληρώθηκε", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  REJECTED: { label: "Απορρίφθηκε", className: "border-chart-5/40 bg-chart-5/10 text-chart-5" },
  FAILED: { label: "Απέτυχε", className: "border-chart-5/40 bg-chart-5/10 text-chart-5" },
} as const;

export function ContractRequestsClient({
  requests,
  capacity,
}: {
  requests: ChangeRequestDTO[];
  capacity: CapacityDTO[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const waiting = requests.filter((r) => r.status === "PENDING");
  const failed = requests.filter((r) => r.status === "FAILED");
  const totalEmpty = capacity.reduce((s, c) => s + c.empty, 0);

  const run = (id: string, fn: () => Promise<{ success?: boolean; error?: string; note?: string }>) => {
    setBusy(id);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (r.error) toast.error(r.error, { duration: 8000 });
      else toast.success(r.note ?? "Η ενέργεια ολοκληρώθηκε.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <KpiTile label="Σε αναμονή" value={waiting.length} icon={Clock} tone="amber" />
        <KpiTile label="Απέτυχαν" value={failed.length} icon={X} tone="red" />
        <KpiTile
          label="Ελεύθερες θέσεις"
          value={totalEmpty}
          hint={`σε ${capacity.length} συμβάσεις`}
          icon={LayoutGrid}
          tone="blue"
        />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Αιτήματα ({waiting.length})</TabsTrigger>
          <TabsTrigger value="capacity">Κενές γραμμές ({capacity.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Αιτήματα πελατών</CardTitle>
              <CardDescription>
                Η έγκριση γράφει απευθείας στο SoftOne. Η πινακίδα μπαίνει σε κενή γραμμή της
                σύμβασης αν υπάρχει, ώστε να μη μεγαλώνει η σύμβαση χωρίς λόγο.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {requests.length === 0 ? (
                <EmptyState icon={Inbox} title="Κανένα αίτημα" description="Δεν υπάρχουν αιτήματα πελατών." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Αίτημα</TableHead>
                        <TableHead>Σύμβαση</TableHead>
                        <TableHead>Πελάτης</TableHead>
                        <TableHead>Υποβλήθηκε</TableHead>
                        <TableHead>Κατάσταση</TableHead>
                        <TableHead className="text-right">Ενέργειες</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((r) => {
                        const meta = STATUS[r.status];
                        const working = busy === r.id && pending;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="font-medium">{TYPE_LABEL[r.type]}</div>
                              {r.plate && <div className="font-mono text-sm">{r.plate}</div>}
                              {r.newPeriod && (
                                <div className="text-xs text-muted-foreground">
                                  {r.newName} · {r.newPeriod} · {r.slots} θέσεις
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {r.inst}
                              {r.type === "ADD_PLATE" && (
                                <div className="text-xs text-muted-foreground">
                                  {r.emptyLines > 0
                                    ? `${r.emptyLines} κενές γραμμές`
                                    : "χωρίς κενή — θα προστεθεί νέα"}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-44 truncate text-sm">{r.requester}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {r.createdAt}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={meta.className}>
                                {meta.label}
                              </Badge>
                              {r.error && (
                                <div className="mt-1 max-w-64 text-xs text-destructive">{r.error}</div>
                              )}
                              {r.note && (
                                <div className="mt-1 max-w-64 text-xs text-muted-foreground">{r.note}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.status === "PENDING" ? (
                                <div className="flex justify-end gap-1.5">
                                  {r.type === "RENEW" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={working}
                                      onClick={() => run(r.id, () => markApplied(r.id))}
                                    >
                                      {working ? <Spinner data-icon="inline-start" /> : <Check />}
                                      Καταχωρήθηκε
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      disabled={working}
                                      onClick={() => run(r.id, () => approveRequest(r.id))}
                                    >
                                      {working ? <Spinner data-icon="inline-start" /> : <Check />}
                                      Έγκριση
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={working}
                                    onClick={() => run(r.id, () => rejectRequest(r.id))}
                                  >
                                    <X />
                                    Απόρριψη
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
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
        </TabsContent>

        <TabsContent value="capacity" className="mt-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Συμβάσεις με κενές γραμμές</CardTitle>
              <CardDescription>
                Θέσεις που δημιουργήθηκαν αλλά δεν τους αποδόθηκε ποτέ πινακίδα. Κάθε νέα
                πινακίδα συμπληρώνει μία από αυτές πριν προστεθεί καινούργια γραμμή.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {capacity.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="Καμία κενή γραμμή"
                  description="Όλες οι γραμμές των ενεργών συμβάσεων έχουν πινακίδα."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Σύμβαση</TableHead>
                      <TableHead className="text-right">Θέσεις</TableHead>
                      <TableHead className="text-right">Με πινακίδα</TableHead>
                      <TableHead className="text-right">Κενές</TableHead>
                      <TableHead className="text-right">Όριο (3/θέση)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capacity.map((c) => {
                      const limit = (c.slots ?? 1) * 3;
                      const over = c.filled > limit;
                      return (
                        <TableRow key={c.inst}>
                          <TableCell>
                            <span className="tabular-nums">{c.inst}</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {(c.name ?? "").slice(0, 38)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.slots ?? "—"}</TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${over ? "font-semibold text-chart-5" : ""}`}
                          >
                            {c.filled}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.empty}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {limit}
                            {over && <span className="ml-1 text-chart-5">υπέρβαση</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
