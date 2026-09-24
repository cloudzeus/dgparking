"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Η φόρμα αιτήματος για εκδήλωση.
 *
 * ΓΙΑΤΙ ΤΟΣΟ ΛΙΓΑ ΠΕΔΙΑ
 * Το αίτημα δεν είναι κράτηση. Χρειάζεται μόνο ό,τι απαιτείται για να
 * απαντήσει κάποιος με τιμή: πότε, πόσο, πόσες θέσεις, και πώς θα σας βρει.
 * Κάθε επιπλέον πεδίο σε αυτό το σημείο κοστίζει αιτήματα που δεν στέλνονται.
 *
 * ΓΙΑΤΙ ΕΠΙΒΕΒΑΙΩΣΗ ΜΕΣΑ ΣΤΟ MODAL
 * Το κλείσιμο του παραθύρου με ένα toast αφήνει τον χρήστη να αναρωτιέται αν
 * στάλθηκε. Το παράθυρο μένει ανοιχτό και δείχνει τι ακολουθεί.
 */
export function EventRfpDialog({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("events.form");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(2, t("name")),
    company: z.string().trim().optional(),
    email: z.string().trim().email(t("email")),
    phone: z.string().trim().min(6, t("phone")),
    eventDate: z.string().min(1, t("eventDate")),
    timeFrom: z.string().min(1, t("timeFrom")),
    timeTo: z.string().min(1, t("timeTo")),
    spaces: z.coerce.number().int().min(1).max(500),
    eventType: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    consent: z.literal(true),
  });

  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      eventDate: "",
      timeFrom: "",
      timeTo: "",
      spaces: 10,
      eventType: "",
      notes: "",
      consent: false as unknown as true,
    },
  });

  const { timeFrom, timeTo } = form.watch();
  const overnight = !!timeFrom && !!timeTo && timeTo <= timeFrom;

  async function onSubmit(values: z.input<typeof schema>) {
    try {
      const res = await fetch("/api/send-event-rfp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, locale, gdprConsentText: t("consent") }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || t("error"));
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    }
  }

  // Καθαρίζει μόνο όταν κλείσει, ώστε ένα κατά λάθος κλικ έξω να μη σβήσει
  // ό,τι πληκτρολόγησε ο επισκέπτης όσο το παράθυρο είναι ακόμα ανοιχτό.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && sent) {
      setSent(false);
      form.reset();
    }
  }

  // Δεν δεχόμαστε αιτήματα για χθες.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="lg" className={className}>
            <CalendarClock aria-hidden />
            RFP
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {sent ? (
          <div className="py-4 text-center">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-chart-2/10 text-chart-2">
              <CheckCircle2 className="size-7" aria-hidden />
            </span>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-center">{t("successTitle")}</DialogTitle>
              <DialogDescription className="text-center">{t("successBody")}</DialogDescription>
            </DialogHeader>
            <Button className="mt-6" onClick={() => onOpenChange(false)}>
              OK
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("name")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("namePlaceholder")} autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("company")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("companyPlaceholder")}
                            autoComplete="organization"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("email")}</FormLabel>
                        <FormControl>
                          <Input type="email" inputMode="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("phone")}</FormLabel>
                        <FormControl>
                          <Input type="tel" inputMode="tel" autoComplete="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="eventDate"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>{t("eventDate")}</FormLabel>
                        <FormControl>
                          <Input type="date" min={today} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("timeFrom")}</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("timeTo")}</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {overnight && (
                  <p className="-mt-1 text-xs text-muted-foreground">{t("overnightHint")}</p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="spaces"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("spaces")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={500}
                            inputMode="numeric"
                            {...field}
                            value={String(field.value ?? "")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="eventType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("eventType")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("eventTypePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("notes")}</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder={t("notesPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="consent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormDescription className="text-xs">{t("consent")}</FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
                    {form.formState.isSubmitting ? t("sending") : t("submit")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
