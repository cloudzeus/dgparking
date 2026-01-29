import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LprLogsClient } from "@/components/lpr/lpr-logs-client";

export default async function LprLogsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and MANAGER can access
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return <LprLogsClient />;
}
