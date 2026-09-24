"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";

const SERVICE_TYPES = ["monthly", "vip", "reserved", "fleet", "events"] as const;
const VEHICLE_COUNTS = ["1-5", "6-10", "11-20", "21-50", "50+"] as const;
const ACCESS_OPTIONS = ["weekdays", "weekends", "all-week", "24-7", "custom"] as const;

type ProposalValues = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  serviceType: string;
  vehicleCount: string;
  accessNeeded: string;
  additionalInfo: string;
  agreement: boolean;
  consent: boolean;
};

/** Αίτημα επαγγελματικής προσφοράς — στέλνει στο `/api/send-proposal`. */
export function ProposalRequestDialog() {
  const t = useTranslations("business.proposal");
  const tConsent = useTranslations("gdpr.consentCheckbox");
  const [open, setOpen] = useState(false);

  // Τα μηνύματα λάθους έρχονται από τα i18n αρχεία, γι' αυτό το schema φτιάχνεται εδώ.
  const schema = z.object({
    companyName: z.string().trim().min(2, t("errors.companyName")),
    contactName: z.string().trim().min(3, t("errors.contactName")),
    email: z.string().trim().email(t("errors.email")),
    phone: z.string().trim().min(10, t("errors.phone")),
    serviceType: z.string().min(1, t("errors.serviceType")),
    vehicleCount: z.string().min(1, t("errors.vehicleCount")),
    accessNeeded: z.string().min(1, t("errors.accessNeeded")),
    additionalInfo: z.string(),
    agreement: z.boolean().refine((value) => value === true, t("errors.agreement")),
    consent: z.boolean().refine((value) => value === true, tConsent("required")),
  });

  const form = useForm<ProposalValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      serviceType: "",
      vehicleCount: "",
      accessNeeded: "",
      additionalInfo: "",
      agreement: false,
      consent: false,
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: ProposalValues) {
    try {
      // Η συγκατάθεση ταξιδεύει χωριστά (`gdprConsent`): το route την
      // καταγράφει και τη βγάζει, ώστε το email να μείνει ακριβώς ίδιο.
      const { consent, ...formData } = values;
      const response = await fetch("/api/send-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          gdprConsent: { text: tConsent("proposal"), accepted: consent },
        }),
      });

      if (!response.ok) throw new Error("Failed to submit proposal request");

      toast.success(t("success"), { duration: 5000 });
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error submitting proposal request:", error);
      toast.error(t("error"), { duration: 5000 });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="mt-2 bg-mega-red text-white hover:brightness-110">{t("trigger")}</Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("companyName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("companyNamePlaceholder")}
                      autoComplete="organization"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contactName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("contactNamePlaceholder")}
                      autoComplete="name"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")}</FormLabel>
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

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder={t("phonePlaceholder")}
                        autoComplete="tel"
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
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("serviceType")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("serviceTypePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SERVICE_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`serviceTypes.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicleCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("vehicleCount")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("vehicleCountPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VEHICLE_COUNTS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`vehicleCounts.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accessNeeded"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t("accessNeeded")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting}
                      className="flex flex-col gap-2"
                    >
                      {ACCESS_OPTIONS.map((value) => (
                        <FormItem key={value} className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value={value} />
                          </FormControl>
                          <FormLabel className="font-normal">{t(`accessOptions.${value}`)}</FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("additionalInfo")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("additionalInfoPlaceholder")}
                      className="resize-none"
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>{t("additionalInfoHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agreement"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                      className="mt-1"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t("agreement")}</FormLabel>
                    <FormDescription>{t("agreementHelp")}</FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="consent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                      className="mt-1"
                    />
                  </FormControl>
                  <div className="min-w-0 space-y-1 leading-none">
                    <FormLabel className="text-sm leading-snug font-normal">
                      {tConsent("proposal")}{" "}
                      <Link href="/privacy" className="underline underline-offset-4">
                        {tConsent("linkText")}
                      </Link>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
