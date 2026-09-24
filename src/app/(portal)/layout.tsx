import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPortalCustomer } from "@/lib/portal-data";
import { PortalShell } from "@/components/portal/portal-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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
    <PortalShell customerName={customer?.name}>
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
    </PortalShell>
  );
}
