"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/newsletter";

/**
 * Εγγραφή στο ενημερωτικό δελτίο — μικρή φόρμα για το υποσέλιδο του site.
 *
 * Διπλή επιβεβαίωση: εδώ ο επισκέπτης δηλώνει τη διεύθυνσή του και τσεκάρει
 * το κουτάκι συγκατάθεσης· το δελτίο ξεκινά μόνο αφού πατήσει τον σύνδεσμο
 * στο email που ακολουθεί. Το κείμενο δίπλα στο checkbox είναι ΤΟ ΙΔΙΟ που
 * αποθηκεύεται στο αρχείο συγκαταθέσεων.
 */
export function NewsletterSignup({ locale = "el" }: { locale?: "el" | "en" }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!consent) {
      setMessage({ tone: "error", text: "Χρειάζεται να δεχτείς την αποστολή ενημερώσεων." });
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale, consent: true }),
      });
      const data = (await res.json()) as { error?: string; alreadySubscribed?: boolean };

      if (!res.ok) {
        setMessage({ tone: "error", text: data.error ?? "Κάτι πήγε στραβά. Δοκίμασε ξανά." });
        return;
      }

      setEmail("");
      setConsent(false);
      setMessage({
        tone: "ok",
        text: data.alreadySubscribed
          ? "Είσαι ήδη στη λίστα μας. Ευχαριστούμε!"
          : "Σου στείλαμε email επιβεβαίωσης — πάτα τον σύνδεσμο για να ολοκληρωθεί η εγγραφή.",
      });
    } catch {
      setMessage({ tone: "error", text: "Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Mail className="size-4" aria-hidden />
        Ενημερωτικό δελτίο
      </h2>
      <p className="text-sm text-muted-foreground">
        Νέα, προσφορές και αλλαγές στο ωράριο — λίγα email τον χρόνο, κανένα spam.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Η διεύθυνση email σου"
          aria-label="Διεύθυνση email"
          autoComplete="email"
          required
          disabled={pending}
          className="min-w-0"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Εγγραφή
        </Button>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="newsletter-consent"
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          disabled={pending}
          className="mt-0.5"
        />
        <Label htmlFor="newsletter-consent" className="text-xs leading-5 font-normal text-muted-foreground">
          {NEWSLETTER_CONSENT_TEXT}
        </Label>
      </div>

      {message && (
        <p
          role="status"
          className={message.tone === "ok" ? "text-xs text-green-700 dark:text-green-400" : "text-xs text-destructive"}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
