import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CalendarDays, Car, FileText } from "lucide-react";
import { getInterestProfile } from "@/lib/portal-interest";
import { PortalInterestForm } from "@/components/site/portal-interest-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Πύλη πελατών — εκδήλωση ενδιαφέροντος",
  // Προσωπικός σύνδεσμος: δεν έχει νόημα σε μηχανή αναζήτησης.
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Η σελίδα που ανοίγει από το κουμπί του δελτίου.
 *
 * Ο σύνδεσμος είναι προσωπικός, οπότε η σελίδα δείχνει στον πελάτη τα δικά του
 * στοιχεία: ποιες συμβάσεις έχει, ποιες πινακίδες είναι δηλωμένες, πότε λήγει.
 * Αυτό είναι και το επιχείρημα — βλέπει με τα μάτια του τι θα έχει μέσα στην
 * πύλη, πριν καν αποκτήσει λογαριασμό.
 */
export default async function PortalInterestPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const profile = await getInterestProfile(token);

  if (!profile) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-20 text-center">
        <h1 className="text-[length:var(--fs-32)] font-bold tracking-tight">
          Ο σύνδεσμος δεν είναι έγκυρος
        </h1>
        <p className="mt-3 text-muted-foreground">
          Μπορεί να έχει λήξει ή να αντιγράφηκε μισός. Απαντήστε στο ενημερωτικό μας
          μήνυμα και θα σας στείλουμε καινούριο.
        </p>
      </section>
    );
  }

  const activePlates = profile.plates.length;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
      <header className="max-w-2xl">
        <p className="font-mono text-[length:var(--fs-11)] uppercase tracking-[0.28em] text-muted-foreground">
          Πύλη πελατών
        </p>
        <h1 className="mt-4 text-[length:var(--fs-40)] font-bold leading-[1.05] tracking-tight">
          {profile.company ? (
            <>
              {profile.company},<br />
              η σύμβασή σας online
            </>
          ) : (
            "Η σύμβασή σας online"
          )}
        </h1>
        <p className="mt-4 text-[length:var(--fs-18)] leading-relaxed text-muted-foreground">
          Παρακάτω είναι ό,τι έχουμε ήδη για εσάς. Αυτά ακριβώς θα βλέπετε στην πύλη, μαζί
          με τα τιμολόγιά σας και τις κινήσεις των οχημάτων σας.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Τα δικά του στοιχεία */}
        <div className="space-y-4">
          {profile.contracts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6">
              <p className="text-sm text-muted-foreground">
                Δεν βρήκαμε ενεργή σύμβαση σε αυτή τη διεύθυνση. Δεν πειράζει — συμπληρώστε
                τη φόρμα και θα τα βρούμε μαζί.
              </p>
            </div>
          ) : (
            profile.contracts.map((c) => (
              <article key={c.inst} className="rounded-2xl border p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-[length:var(--fs-18)] font-semibold">
                    {c.name ?? `Σύμβαση #${c.inst}`}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">#{c.inst}</span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat label="Θέσεις" value={c.slots != null ? String(c.slots) : "—"} />
                  <Stat label="Μέσα τώρα" value={String(c.carsInside)} />
                  <Stat
                    label="Λήγει"
                    value={c.endsOn ? dateFmt.format(c.endsOn) : "—"}
                    hint={
                      c.daysLeft != null
                        ? c.daysLeft >= 0
                          ? `σε ${c.daysLeft} ημέρες`
                          : "έχει λήξει"
                        : undefined
                    }
                  />
                </dl>

                {c.plates.length > 0 && (
                  <div className="mt-5 border-t pt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Car className="size-3.5" aria-hidden />
                      Δηλωμένες πινακίδες
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {c.plates.map((p) => (
                        <li
                          key={p}
                          className="rounded-md border bg-muted/40 px-2.5 py-1 font-mono text-sm"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))
          )}

          {activePlates > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {activePlates} {activePlates === 1 ? "πινακίδα" : "πινακίδες"} συνολικά — στην
              πύλη θα μπορείτε να ζητήσετε προσθήκη ή αφαίρεση χωρίς τηλέφωνο.
            </p>
          )}
        </div>

        {/* Η φόρμα */}
        <div className="rounded-2xl border bg-muted/30 p-5 sm:p-7">
          <h2 className="text-[length:var(--fs-20)] font-semibold">Θέλω πρόσβαση</h2>
          <p className="mb-6 mt-1.5 text-sm text-muted-foreground">
            Επιβεβαιώστε τα στοιχεία σας. Η πρόσβαση δίνεται ονομαστικά.
          </p>
          <PortalInterestForm token={token} profile={profile} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-[length:var(--fs-18)] font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
