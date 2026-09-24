import { getTranslations } from "next-intl/server";
import { Building2, Mail, MapPin, Phone, Scale } from "lucide-react";

/** Ταυτότητα του υπευθύνου επεξεργασίας — άρ. 13 §1 στοιχ. α΄ και β΄. */
export async function ControllerCard() {
  const t = await getTranslations("gdpr.controller");

  return (
    <section className="rounded-lg border bg-card p-6" aria-labelledby="controller-heading">
      <h2 id="controller-heading" className="flex items-center gap-2 text-lg font-semibold">
        <Building2 className="size-5 text-mega-red" aria-hidden />
        {t("title")}
      </h2>

      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="font-medium">{t("name")}</dt>
            <dd className="text-muted-foreground">{t("address")}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="font-medium">{t("emailLabel")}</dt>
            <dd className="text-muted-foreground">
              <a href={`mailto:${t("email")}`} className="underline-offset-4 hover:underline">
                {t("email")}
              </a>
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <dt className="font-medium">{t("phoneLabel")}</dt>
            <dd className="text-muted-foreground">{t("phone")}</dd>
          </div>
        </div>
      </dl>

      <h3 className="mt-6 text-base font-semibold">{t("contactTitle")}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{t("contactText")}</p>
    </section>
  );
}

/** Δικαίωμα καταγγελίας στην εποπτική αρχή — άρ. 13 §2 στοιχ. δ΄, άρ. 77. */
export async function AuthorityCard() {
  const t = await getTranslations("gdpr.authority");

  return (
    <section className="rounded-lg border bg-muted/40 p-6" aria-labelledby="authority-heading">
      <h2 id="authority-heading" className="flex items-center gap-2 text-lg font-semibold">
        <Scale className="size-5 text-mega-red" aria-hidden />
        {t("title")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("text")}</p>
      <p className="mt-3 text-sm font-medium">{t("name")}</p>
      <p className="text-sm text-muted-foreground">{t("address")}</p>
      <p className="text-sm text-muted-foreground">
        <a
          href="https://www.dpa.gr"
          target="_blank"
          rel="noreferrer noopener"
          className="underline-offset-4 hover:underline"
        >
          {t("website")}
        </a>
      </p>
    </section>
  );
}
