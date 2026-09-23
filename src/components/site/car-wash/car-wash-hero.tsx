import { getTranslations } from "next-intl/server";
import { CarWashBookingDialog } from "./car-wash-booking-dialog";

/** Hero της σελίδας πλυσίματος: το μπλε της μάρκας με το κουμπί κράτησης. */
export async function CarWashHero() {
  const t = await getTranslations("carWash.hero");

  return (
    <section className="bg-mega-blue text-white" aria-labelledby="car-wash-heading">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
            {t("badge")}
          </span>
          <h1 id="car-wash-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-base text-white/85 sm:text-lg">{t("description")}</p>
          <CarWashBookingDialog size="lg" className="bg-mega-red text-white hover:brightness-110" />
        </div>
      </div>
    </section>
  );
}
