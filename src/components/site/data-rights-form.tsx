"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { RIGHT_KEYS, isRightKey } from "@/components/site/right-keys";

type RequestValues = {
  type: string;
  fullName: string;
  email: string;
  message: string;
  consent: boolean;
};

/**
 * Φόρμα άσκησης δικαιωμάτων. Δεν εμφανίζει ποτέ IP ή συσκευή — αυτά
 * καταγράφονται μόνο στο μητρώο της διαχείρισης, ως απόδειξη.
 */
export function DataRightsForm() {
  const t = useTranslations("gdpr.dataRights.form");
  const tRights = useTranslations("gdpr.dataRights.rights");
  const tConsent = useTranslations("gdpr.consentCheckbox");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const preselected = searchParams?.get("right") ?? null;

  const schema = z.object({
    type: z.string().refine(isRightKey, t("errors.type")),
    fullName: z.string().trim().min(2, t("errors.name")),
    email: z.string().trim().email(t("errors.email")),
    message: z.string(),
    consent: z.boolean().refine((value) => value === true, t("errors.consent")),
  });

  const form = useForm<RequestValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: isRightKey(preselected) ? preselected : "",
      fullName: "",
      email: "",
      message: "",
      consent: false,
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: RequestValues) {
    try {
      const response = await fetch("/api/gdpr/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          fullName: values.fullName,
          email: values.email,
          message: values.message,
          locale,
          consentText: t("consent"),
        }),
      });

      if (!response.ok) throw new Error("Failed to submit the request");

      toast.success(t("successTitle"), { description: t("successDescription"), duration: 8000 });
      form.reset({ type: "", fullName: "", email: "", message: "", consent: false });
    } catch (error) {
      console.error("Error submitting the data subject request:", error);
      toast.error(t("errorTitle"), { description: t("errorDescription"), duration: 8000 });
    }
  }

  return (
    <Card id="request">
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("typeLabel")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("typePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {RIGHT_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {tRights(`${key}.title`)} — {tRights(`${key}.article`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
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
                    <FormDescription>{t("emailHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      className="min-h-28"
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
                      {t("consent")}{" "}
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
              className="w-full bg-mega-red text-white hover:brightness-110 sm:w-auto"
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
