import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Check if admin user exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    console.log("✅ Admin user already exists");
    return;
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@kolleris.gr",
      password: hashedPassword,
      firstName: "ADMIN",
      lastName: "USER",
      role: "ADMIN",
      isActive: true,
      country: "GR",
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Create sample users for each role
  const roles = ["MANAGER", "EMPLOYEE", "CLIENT"] as const;

  for (const role of roles) {
    const user = await prisma.user.create({
      data: {
        email: `${role.toLowerCase()}@kolleris.gr`,
        password: hashedPassword,
        firstName: role,
        lastName: "USER",
        role: role,
        isActive: true,
        country: "GR",
      },
    });
    console.log(`✅ ${role} user created: ${user.email}`);
  }

  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });











