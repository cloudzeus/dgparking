import { getTranslations } from "next-intl/server";

/** Επικεφαλίδα της σελίδας επικοινωνίας, στο μπλε της μάρκας. */
export async function ContactHero() {
  const t = await getTranslations("contact.hero");

  return (
    <section
      className="border-b bg-[linear-gradient(to_right,var(--mega-blue),rgba(23,40,91,0.88))]"
      aria-labelledby="contact-heading"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center text-white sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h1 id="contact-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-base text-white/85 sm:text-lg">{t("description")}</p>
        </div>
      </div>
    </section>
  );
}
