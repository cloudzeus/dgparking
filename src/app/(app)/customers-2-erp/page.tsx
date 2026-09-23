import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader, EmptyState } from "@/components/admin/page";
import { Link2 } from "lucide-react";

export default async function Customers2ERPPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only allow ADMIN role
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Πελάτες προς ERP"
        description="Συγχρονισμός των στοιχείων πελατών με το ERP."
        icon={Link2}
      />

      <EmptyState
        icon={Link2}
        title="Η σύνδεση δεν είναι ακόμη διαθέσιμη"
        description="Εδώ θα βλέπετε την κατάσταση συγχρονισμού ανά πελάτη, θα ξεκινάτε συγχρονισμό με το χέρι, θα διαβάζετε το ιστορικό και θα ορίζετε τις αντιστοιχίσεις πεδίων."
      />
    </div>
  );
}
