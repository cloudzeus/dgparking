import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConsentsClient } from "@/components/gdpr/consents-client";

/** Πόσες εγγραφές φορτώνουμε — αρκετές για αναζήτηση, χωρίς να πνίγεται η σελίδα. */
const MAX_ROWS = 2000;

export default async function ConsentsPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  // Το μητρώο περιέχει IP και συσκευή επισκεπτών: μόνο διαχειριστές.
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const consents = await prisma.consentLog.findMany({
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      email: true,
      type: true,
      action: true,
      consentText: true,
      policyVersion: true,
      ipAddress: true,
      userAgent: true,
      sourceUrl: true,
      locale: true,
      method: true,
      createdAt: true,
    },
  });

  return <ConsentsClient consents={consents} />;
}
