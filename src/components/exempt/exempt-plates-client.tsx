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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/admin/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  addExemptPlate,
  deactivateExemptPlate,
  suggestExemptPlates,
  type Suggestion,
} from "@/lib/actions/exempt-plates";
import { EXEMPT_CATEGORIES } from "@/lib/exempt-plates";
import { toast } from "sonner";
import { AlertCircle, Plus, Search, ShieldOff, Sparkles, X } from "lucide-react";

export type ExemptPlateDTO = {
  id: string;
  plate: string;
  category: string;
  note: string | null;
  isActive: boolean;
  validFrom: string;
  validUntil: string | null;
};

export function ExemptPlatesClient({ plates }: { plates: ExemptPlateDTO[] }) {
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState("");
  const [category, setCategory] = useState<string>(EXEMPT_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const active = plates.filter((p) => p.isActive);
  const visible = plates.filter(
    (p) => !query.trim() || p.plate.includes(query.trim().toUpperCase())
  );

  const submit = () => {
    if (!plate.trim()) return;
    startTransition(async () => {
      const r = await addExemptPlate(plate, category, note);
      if (r.error) toast.error(r.error);
      else {
        toast.success(`Η ${plate.toUpperCase()} καταχωρήθηκε.`);
        setPlate("");
        setNote("");
      }
    });
  };

  const loadSuggestions = () => {
    setLoadingSuggestions(true);
    startTransition(async () => {
      const list = await suggestExemptPlates(6);
      setSuggestions(list);
      setLoadingSuggestions(false);
      if (list.length === 0) toast.info("Δεν βρέθηκαν υποψήφιες πινακίδες.");
    });
  };

  const adopt = (s: Suggestion) =>
    startTransition(async () => {
      const r = await addExemptPlate(s.plate, "Προσωπικό", `Από πρόταση: ${s.stays} στάσεις, ${s.dueTotal} € μη χρεωμένα`);
      if (r.error) toast.error(r.error);
      else {
        toast.success(`Η ${s.plate} καταχωρήθηκε.`);
        setSuggestions((prev) => prev?.filter((x) => x.plate !== s.plate) ?? null);
      }
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Καταχώρηση πινακίδας</CardTitle>
          <CardDescription>
            Η απαλλαγή ισχύει <strong>από σήμερα και μετά</strong> — οι παλαιότερες στάσεις
            παραμένουν χρεώσιμες, ώστε να μη «σβήνεται» το ιστορικό.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plate">Πινακίδα</Label>
              <Input
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="π.χ. ΙΚΑ4707"
                className="w-40 font-mono uppercase"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Κατηγορία</Label>
              <Select value={category} onValueChange={setCategory} disabled={pending}>
                <SelectTrigger id="category" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXEMPT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="note">Σημείωση</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Ποιος το χρησιμοποιεί"
                disabled={pending}
              />
            </div>
            <Button onClick={submit} disabled={pending || !plate.trim()}>
              {pending ? <Spinner data-icon="inline-start" /> : <Plus />}
              Καταχώρηση
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="list">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="list">Καταχωρημένες ({active.length})</TabsTrigger>
            <TabsTrigger value="suggest">Προτάσεις</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση…"
              className="pl-8"
            />
          </div>
        </div>

        <TabsContent value="list" className="mt-3">
          <Card>
            <CardContent className="p-0">
              {visible.length === 0 ? (
                <EmptyState
                  icon={ShieldOff}
                  title="Καμία απαλλαγμένη πινακίδα"
                  description="Καταχωρήστε πινακίδες ή δείτε τις προτάσεις από τα δεδομένα."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Πινακίδα</TableHead>
                      <TableHead>Κατηγορία</TableHead>
                      <TableHead>Σημείωση</TableHead>
                      <TableHead>Ισχύει από</TableHead>
                      <TableHead>Κατάσταση</TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-medium">{p.plate}</TableCell>
                        <TableCell>{p.category}</TableCell>
                        <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                          {p.note ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{p.validFrom}</TableCell>
                        <TableCell>
                          {p.isActive ? (
                            <Badge
                              variant="outline"
                              className="border-chart-2/40 bg-chart-2/10 text-chart-2"
                            >
                              Ενεργή
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Έληξε {p.validUntil}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() =>
                                startTransition(async () => {
                                  const r = await deactivateExemptPlate(p.id);
                                  if (r.error) toast.error(r.error);
                                  else toast.success(`Η απαλλαγή της ${p.plate} έληξε.`);
                                })
                              }
                            >
                              <X />
                              Λήξη
                            </Button>
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

        <TabsContent value="suggest" className="mt-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Υποψήφιες από τα δεδομένα</CardTitle>
              <CardDescription>
                Οχήματα εκτός σύμβασης με τουλάχιστον τρεις στάσεις που δεν χρεώθηκαν. Όσα
                δεν χρεώθηκαν <strong>ποτέ</strong> είναι σχεδόν σίγουρα συμφωνία.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {suggestions === null ? (
                <div className="flex flex-col items-start gap-3">
                  <Alert>
                    <AlertCircle />
                    <AlertTitle>Διαβάζει το ψηφιακό πελατολόγιο</AlertTitle>
                    <AlertDescription>
                      Η ανάλυση καλεί το SoftOne για έξι μήνες και παίρνει λίγο χρόνο, γι&apos; αυτό
                      δεν τρέχει αυτόματα.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={loadSuggestions} disabled={loadingSuggestions}>
                    {loadingSuggestions ? <Spinner data-icon="inline-start" /> : <Sparkles />}
                    Ανάλυση 6 μηνών
                  </Button>
                </div>
              ) : suggestions.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Καμία υποψήφια"
                  description="Δεν βρέθηκαν οχήματα με επαναλαμβανόμενες μη χρεωμένες στάσεις."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Πινακίδα</TableHead>
                        <TableHead className="text-right">Στάσεις</TableHead>
                        <TableHead className="text-right">Χρεώθηκε</TableHead>
                        <TableHead className="text-right">Μη χρεωμένα</TableHead>
                        <TableHead>Περίοδος</TableHead>
                        <TableHead className="text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestions.map((s) => (
                        <TableRow key={s.plate}>
                          <TableCell className="font-mono font-medium">{s.plate}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.stays}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.neverCharged ? (
                              <Badge
                                variant="outline"
                                className="border-chart-2/40 bg-chart-2/10 text-chart-2"
                              >
                                ποτέ
                              </Badge>
                            ) : (
                              <span className="text-chart-3">{s.timesCharged} φορές</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.dueTotal.toFixed(2)} €
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {s.firstSeen} — {s.lastSeen}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" disabled={pending} onClick={() => adopt(s)}>
                              <Plus />
                              Απαλλαγή
                            </Button>
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
      </Tabs>
    </div>
  );
}
