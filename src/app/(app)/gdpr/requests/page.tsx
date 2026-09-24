import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RequestsClient } from "@/components/gdpr/requests-client";

export default async function DataRequestsPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  // Τα αιτήματα περιέχουν στοιχεία ταυτοποίησης: μόνο διαχειριστές.
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const requests = await prisma.dataSubjectRequest.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    select: {
      id: true,
      email: true,
      fullName: true,
      type: true,
      status: true,
      message: true,
      verifiedAt: true,
      dueAt: true,
      handledAt: true,
      resolution: true,
      ipAddress: true,
      userAgent: true,
      locale: true,
      createdAt: true,
    },
  });

  return <RequestsClient requests={requests} />;
}
