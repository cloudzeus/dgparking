import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { LicenseModal } from "@/components/account/license-modal";

export default async function LicensePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const buyerName = process.env.BUYER_NAME ?? "—";
  const buyerVat = process.env.BUYER_VAT ?? "—";
  const buyerSerial = process.env.BUYER_SERIAL ?? "—";
  const activationDateRaw = process.env.BUYER_ACTIVATION_DATE;
  const sellerName =
    process.env.SELLER_NAME?.replace(/^"|"$/g, "").trim() ?? "—";
  const sellerVat = process.env.SELLER_VAT ?? "—";

  let activationDateFormatted = "—";
  if (activationDateRaw) {
    try {
      const d = parseISO(activationDateRaw);
      if (!isNaN(d.getTime())) {
        activationDateFormatted = format(d, "MMMM d, yyyy");
      }
    } catch {
      activationDateFormatted = activationDateRaw;
    }
  }

  const license = {
    buyerName,
    buyerVat,
    buyerSerial,
    activationDateFormatted,
    sellerName,
    sellerVat,
  };

  return (
    <LicenseModal
      license={license}
      open={true}
    />
  );
}
