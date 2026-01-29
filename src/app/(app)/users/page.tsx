import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "@/components/users/users-client";

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and MANAGER can access
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      address: true,
      zip: true,
      city: true,
      country: true,
      phone: true,
      mobile: true,
      workPhone: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return <UsersClient users={users} currentUserRole={session.user.role} />;
}











