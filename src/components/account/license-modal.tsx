"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface LicenseData {
  buyerName: string;
  buyerVat: string;
  buyerSerial: string;
  activationDateFormatted: string;
  sellerName: string;
  sellerVat: string;
}

interface LicenseModalProps {
  license: LicenseData;
  open: boolean;
}

export function LicenseModal({ license, open }: LicenseModalProps) {
  const router = useRouter();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      router.push("/account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Πιστοποιητικό άδειας χρήσης λογισμικού</DialogTitle>
          <DialogDescription>
            Το παρόν αποτελεί την επίσημη παραχώρηση άδειας χρήσης για το λογισμικό που παρέχει
            η {license.sellerName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Στοιχεία άδειας</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Πεδίο</TableHead>
                  <TableHead>Τιμή</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">Κάτοχος άδειας (αγοραστής)</TableCell>
                  <TableCell className="whitespace-normal break-words">{license.buyerName}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">ΑΦΜ αγοραστή</TableCell>
                  <TableCell className="tabular-nums">{license.buyerVat}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Σειριακός αριθμός</TableCell>
                  <TableCell className="font-mono">{license.buyerSerial}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Ημερομηνία ενεργοποίησης</TableCell>
                  <TableCell>{license.activationDateFormatted}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-muted-foreground">Παραχώρηση άδειας</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Με βάση τους όρους και τις προϋποθέσεις της παρούσας συμφωνίας, η{" "}
              {license.sellerName} (ΑΦΜ πωλητή: {license.sellerVat}) παραχωρεί στον/στην{" "}
              {license.buyerName} μη αποκλειστική και μη μεταβιβάσιμη άδεια χρήσης του λογισμικού
              που αντιστοιχεί στον παραπάνω σειριακό αριθμό.
            </p>
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-muted-foreground">Όροι χρήσης</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Η άδεια ισχύει από την ημερομηνία ενεργοποίησης που αναγράφεται παραπάνω.</li>
              <li>Η άδεια είναι συνδεδεμένη με την οντότητα που ταυτοποιείται από το ΑΦΜ του αγοραστή.</li>
              <li>
                Απαγορεύεται αυστηρά κάθε μη εξουσιοδοτημένη διανομή, αντίστροφη μηχανίκευση ή
                τροποποίηση του λογισμικού.
              </li>
            </ul>
          </section>

          <p className="border-t pt-3 text-xs text-muted-foreground">
            Σημείωση: φυλάξτε τα στοιχεία της άδειας και τον σειριακό αριθμό σε ασφαλές σημείο.
            Μπορεί να σας ζητηθούν για μελλοντικές αναβαθμίσεις ή τεχνική υποστήριξη.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
