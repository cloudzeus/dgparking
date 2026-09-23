"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/admin/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export type WorkingHoursRow = {
  dayOfWeek: number;
  label: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

interface SettingsClientProps {
  initialWorkingHours: WorkingHoursRow[];
}

/** Ελληνικά ονόματα ημερών — παρουσίαση μόνο, ανεξάρτητα από την ετικέτα που έρχεται από το API. */
const DAY_LABELS: Record<number, string> = {
  0: "Κυριακή",
  1: "Δευτέρα",
  2: "Τρίτη",
  3: "Τετάρτη",
  4: "Πέμπτη",
  5: "Παρασκευή",
  6: "Σάββατο",
};

export function SettingsClient({ initialWorkingHours }: SettingsClientProps) {
  const [workingHours, setWorkingHours] =
    useState<WorkingHoursRow[]>(initialWorkingHours);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWorkingHours(initialWorkingHours);
  }, [initialWorkingHours]);

  const loadWorkingHours = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/working-hours");
      const data = await res.json();
      if (data.success && data.workingHours) {
        setWorkingHours(data.workingHours);
      }
    } catch (e) {
      toast.error("Η φόρτωση του ωραρίου απέτυχε");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingHours: workingHours.map((row) => ({
            dayOfWeek: row.dayOfWeek,
            openTime: row.isClosed ? null : row.openTime,
            closeTime: row.isClosed ? null : row.closeTime,
            isClosed: row.isClosed,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Το ωράριο αποθηκεύτηκε");
      } else {
        toast.error(data.error || "Η αποθήκευση απέτυχε");
      }
    } catch (e) {
      toast.error("Η αποθήκευση του ωραρίου απέτυχε");
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (dayOfWeek: number, patch: Partial<WorkingHoursRow>) => {
    setWorkingHours((prev) =>
      prev.map((row) =>
        row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row
      )
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ρυθμίσεις"
        description="Ωράριο λειτουργίας του πάρκινγκ ανά ημέρα — καθορίζει την πρόσβαση και την τιμολόγηση."
        icon={Clock}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={loadWorkingHours}
              disabled={loading}
              title="Ανανέωση από τη βάση"
            >
              {loading ? <Spinner /> : <RefreshCw />}
              Ανανέωση
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} title="Αποθήκευση ωραρίου">
              {saving ? <Spinner /> : <Save />}
              Αποθήκευση
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-primary" aria-hidden />
            Ωράριο λειτουργίας
          </CardTitle>
          <CardDescription>
            Ορίστε ώρα ανοίγματος και κλεισίματος για κάθε ημέρα. Οι κλειστές ημέρες δεν έχουν ώρες.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ημέρα</TableHead>
                <TableHead>Κλειστά</TableHead>
                <TableHead>Άνοιγμα</TableHead>
                <TableHead>Κλείσιμο</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workingHours.map((row) => (
                <TableRow key={row.dayOfWeek}>
                  <TableCell className="font-medium">
                    {DAY_LABELS[row.dayOfWeek] ?? row.label}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`closed-${row.dayOfWeek}`}
                        checked={row.isClosed}
                        onCheckedChange={(checked) =>
                          updateRow(row.dayOfWeek, { isClosed: checked })
                        }
                      />
                      <Label htmlFor={`closed-${row.dayOfWeek}`} className="text-xs">
                        {row.isClosed ? "Κλειστά" : "Ανοιχτά"}
                      </Label>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.isClosed ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Input
                        type="time"
                        aria-label={`Ώρα ανοίγματος — ${DAY_LABELS[row.dayOfWeek] ?? row.label}`}
                        value={row.openTime}
                        onChange={(e) =>
                          updateRow(row.dayOfWeek, { openTime: e.target.value })
                        }
                        className="h-8 w-32 tabular-nums"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.isClosed ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Input
                        type="time"
                        aria-label={`Ώρα κλεισίματος — ${DAY_LABELS[row.dayOfWeek] ?? row.label}`}
                        value={row.closeTime}
                        onChange={(e) =>
                          updateRow(row.dayOfWeek, { closeTime: e.target.value })
                        }
                        className="h-8 w-32 tabular-nums"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
