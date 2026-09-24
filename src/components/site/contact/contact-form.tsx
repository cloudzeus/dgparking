"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/i18n/navigation";

type ContactValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
  consent: boolean;
};

/** Η φόρμα επικοινωνίας — στέλνει στο `/api/send-contact` (ίδιο payload με το παλιό site). */
export function ContactForm() {
  const t = useTranslations("contact.form");
  const tConsent = useTranslations("gdpr.consentCheckbox");

  // Τα μηνύματα λάθους έρχονται από τα i18n αρχεία, γι' αυτό το schema φτιάχνεται εδώ.
  const schema = z.object({
    name: z.string().trim().min(1, t("errors.name")),
    email: z.string().trim().email(t("errors.email")),
    subject: z.string().trim().min(1, t("errors.subject")),
    message: z.string().trim().min(1, t("errors.message")),
    consent: z.boolean().refine((value) => value === true, tConsent("required")),
  });

  const form = useForm<ContactValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", subject: "", message: "", consent: false },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: ContactValues) {
    try {
      // Η συγκατάθεση ταξιδεύει χωριστά (`gdprConsent`): το route την
      // καταγράφει και τη βγάζει, ώστε το email να μείνει ακριβώς ίδιο.
      const response = await fetch("/api/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          subject: values.subject,
          message: values.message,
          gdprConsent: { text: tConsent("contact") },
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      toast.success(t("successTitle"), {
        description: t("successDescription"),
        duration: 5000,
      });
      form.reset();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(t("errorTitle"), { duration: 5000 });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("nameLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("namePlaceholder")}
                        autoComplete="name"
                        disabled={isSubmitting}
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
                    <FormLabel>{t("emailLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        autoComplete="email"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("subjectLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("subjectPlaceholder")}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("messageLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("messagePlaceholder")}
                      className="min-h-[150px]"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="consent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <div className="min-w-0 space-y-1">
                    <FormLabel className="text-sm leading-snug font-normal">
                      {tConsent("contact")}{" "}
                      <Link href="/privacy" className="underline underline-offset-4">
                        {tConsent("linkText")}
                      </Link>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-mega-red text-white hover:brightness-110"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
