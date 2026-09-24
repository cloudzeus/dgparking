import { NextIntlClientProvider } from "next-intl";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { LogOut, UserRound } from "lucide-react";

/**
 * Το κέλυφος που βλέπει ο πελάτης.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΤΟ SITE ΚΑΙ ΟΧΙ Η ΕΦΑΡΜΟΓΗ
 * Ο πελάτης δεν είναι χρήστης του διαχειριστικού. Έρχεται από το megaparking.gr,
 * και το portal πρέπει να είναι η συνέχεια εκείνης της σελίδας — ίδια μάρκα,
 * ίδια κεφαλίδα, ίδιο υποσέλιδο, ίδια πλοήγηση προς τιμές και επικοινωνία.
 * Ένα κέλυφος διαχείρισης, με sidebar και εσωτερικές ονομασίες, θα τον έκανε
 * να νιώθει ότι μπήκε σε λάθος πόρτα.
 *
 * Χρησιμοποιεί ΤΑ ΙΔΙΑ `SiteHeader` / `SiteFooter` με το δημόσιο site, ώστε μια
 * αλλαγή στο site να φτάνει εδώ μόνη της και να μην αποκλίνουν ποτέ οι δύο
 * εικόνες. Το `NextIntlClientProvider` χρειάζεται επειδή το portal ζει έξω από
 * το `[locale]`· η ρύθμιση πέφτει πίσω στα ελληνικά, που είναι η γλώσσα των
 * συμβάσεων.
 */
export function PortalShell({
  customerName,
  children,
  /** Η προεπισκόπηση δεν έχει συνεδρία πελάτη για να αποσυνδέσει. */
  showLogout = true,
  banner,
}: {
  customerName?: string | null;
  children: React.ReactNode;
  showLogout?: boolean;
  banner?: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider>
      <div className="theme-mega flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />

        {/* Λωρίδα λογαριασμού: το μόνο που προστίθεται στο site, γιατί ο
            πελάτης πρέπει να βλέπει ως ποιος είναι συνδεδεμένος. */}
        {(customerName || showLogout) && (
          <div className="border-b bg-muted/40">
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <UserRound className="size-4" aria-hidden />
                {customerName ?? "Ο λογαριασμός μου"}
              </span>
              {showLogout && (
                <form action={logout}>
                  <Button type="submit" variant="ghost" size="sm">
                    <LogOut />
                    Αποσύνδεση
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {banner}
          {children}
        </main>

        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  );
}
