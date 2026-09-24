import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getPortalCustomer } from "@/lib/portal-data";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { logout } from "@/lib/actions/auth";
import { AlertCircle, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Κέλυφος portal πελατών.
 *
 * Σκόπιμα ΔΕΝ χρησιμοποιεί το sidebar της διαχείρισης: ο πελάτης δεν πρέπει να
 * βλέπει καν τα ονόματα των εσωτερικών σελίδων. Η πρόσβαση ελέγχεται εδώ μία
 * φορά, και ο πελάτης προκύπτει πάντα από τη συνεδρία.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Το προσωπικό της εταιρίας δεν έχει δουλειά στο portal — έχει τη διαχείριση.
  if (["ADMIN", "MANAGER", "EMPLOYEE"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const customer = await getPortalCustomer(session.user.id as string);

  return (
    <div className="theme-mega flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/client" aria-label="MEGA Parking">
            <Image
              src="/images/MEGAParkingLogoWide.svg"
              alt="MEGA Parking"
              width={160}
              height={38}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <div className="flex items-center gap-3">
            {customer && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {customer.name}
              </span>
            )}
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut />
                Αποσύνδεση
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {customer ? (
          children
        ) : (
          <Alert>
            <AlertCircle />
            <AlertTitle>Ο λογαριασμός σας δεν έχει συνδεθεί ακόμα με πελάτη</AlertTitle>
            <AlertDescription>
              Η αίτησή σας είναι σε εξέλιξη. Θα ειδοποιηθείτε με email μόλις ολοκληρωθεί η
              σύνδεση με τα στοιχεία της εταιρείας σας.
            </AlertDescription>
          </Alert>
        )}
      </main>

      <footer className="border-t bg-background py-4">
        <div className="mx-auto w-full max-w-5xl px-4 text-xs text-muted-foreground">
          MEGA Parking · Κ. Μαυρομιχάλη 4, Πειραιάς
        </div>
      </footer>
    </div>
  );
}
