import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountClient } from "@/components/account/account-client";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
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

  if (!user) {
    redirect("/login");
  }

  return <AccountClient user={user} />;
}











