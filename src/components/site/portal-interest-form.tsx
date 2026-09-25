"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitPortalInterest } from "@/lib/actions/portal-interest";
import type { InterestProfile } from "@/lib/portal-interest";

/**
 * Η φόρμα εκδήλωσης ενδιαφέροντος.
 *
 * Ανοίγει συμπληρωμένη: επωνυμία, όνομα και τηλέφωνο τα ξέρουμε από το ERP.
 * Ο πελάτης επιβεβαιώνει ή διορθώνει — δεν πληκτρολογεί ξανά στοιχεία που
 * έχουμε ήδη. Το email δεν αλλάζει: είναι αυτό στο οποίο ήρθε ο σύνδεσμος.
 */
export function PortalInterestForm({
  token,
  profile,
}: {
  token: string;
  profile: InterestProfile;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-8 text-center dark:bg-emerald-950/30">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold">Το αίτημά σας καταγράφηκε</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Θα επικοινωνήσουμε μαζί σας με τα στοιχεία πρόσβασης. Δεν χρειάζεται να κάνετε
          κάτι άλλο.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      action={(formData) =>
        start(async () => {
          setError(null);
          const r = await submitPortalInterest(token, formData);
          if (r.error) setError(r.error);
          else setDone(true);
        })
      }
    >
      <Field label="Επωνυμία" name="company" defaultValue={profile.company ?? ""} required />
      <Field
        label="Όνομα επικοινωνίας"
        name="contactName"
        defaultValue={profile.contactName ?? ""}
        required
      />
      <Field label="Τηλέφωνο" name="phone" defaultValue={profile.phone ?? ""} type="tel" />

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="pi-email">
          Email
        </label>
        <input
          id="pi-email"
          value={profile.email}
          readOnly
          className="w-full rounded-lg border bg-muted px-3.5 py-2.5 text-[length:var(--fs-15)] text-muted-foreground"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Η πρόσβαση θα δοθεί σε αυτή τη διεύθυνση.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="pi-note">
          Θέλετε να μας πείτε κάτι;
        </label>
        <textarea
          id="pi-note"
          name="note"
          rows={3}
          placeholder="π.χ. να έχει πρόσβαση και το λογιστήριο"
          className="w-full rounded-lg border bg-background px-3.5 py-2.5 text-[length:var(--fs-15)]"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-[length:var(--fs-15)] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Θέλω πρόσβαση στην πύλη
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" htmlFor={`pi-${name}`}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <input
        id={`pi-${name}`}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border bg-background px-3.5 py-2.5 text-[length:var(--fs-15)]"
      />
    </div>
  );
}
