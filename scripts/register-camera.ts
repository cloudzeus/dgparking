/**
 * Καταχώρηση κάμερας με ρόλο (είσοδος/έξοδος).
 *
 * Ο ρόλος είναι αυτός που καθορίζει την κατεύθυνση των συμβάντων — το πεδίο
 * `direction` του μηνύματος λέει μόνο αν το όχημα πλησιάζει ή απομακρύνεται
 * από τον φακό και δεν μπορεί να χρησιμοποιηθεί.
 *
 * Το `name` πρέπει να είναι ΑΚΡΙΒΩΣ το `device` που στέλνει η κάμερα.
 *
 *   npx tsx scripts/register-camera.ts "Parking-LPTR-entrance" ENTRY 62.74.24.250
 */
import { PrismaClient, CameraRole } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const [name, role, ip] = process.argv.slice(2);
  if (!name || !["ENTRY", "EXIT"].includes(role)) {
    console.error('Χρήση: register-camera.ts "<device name>" ENTRY|EXIT [ip]');
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, email: true } });
  if (!admin) throw new Error("Δεν βρέθηκε χρήστης ADMIN για ιδιοκτήτης της κάμερας.");

  const existing = await prisma.lprCamera.findFirst({ where: { name } });
  const data = {
    name,
    role: role as CameraRole,
    ipAddress: ip ?? "0.0.0.0",
    deviceId: name,
    location: role === "ENTRY" ? "Είσοδος" : "Έξοδος",
    isActive: true,
  };

  const cam = existing
    ? await prisma.lprCamera.update({ where: { id: existing.id }, data })
    : await prisma.lprCamera.create({ data: { ...data, userId: admin.id } });

  console.log(existing ? "ενημερώθηκε:" : "καταχωρήθηκε:", cam.name, "→", cam.role, `(${cam.ipAddress})`);

  const all = await prisma.lprCamera.findMany({ select: { name: true, role: true, ipAddress: true, isActive: true } });
  console.log("\nκάμερες:");
  all.forEach((c) => console.log(`  ${c.name.padEnd(26)} ${String(c.role).padEnd(8)} ${c.ipAddress}  ${c.isActive ? "ενεργή" : "ανενεργή"}`));
}

main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch(async (e) => {
  console.error(e.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
