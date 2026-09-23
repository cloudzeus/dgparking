"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WASH_SERVICES, WASH_TIME_SLOTS, type WashServiceKey } from "./packages";

type Props = {
  /** Προεπιλεγμένη υπηρεσία, όταν το κουμπί ανοίγει από κάρτα πακέτου. */
  defaultService?: WashServiceKey;
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
};

export function CarWashBookingDialog({
  defaultService,
  label,
  className,
  size = "default",
  variant = "default",
}: Props) {
  const t = useTranslations("carWash.booking");
  const formatter = useFormatter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(3, t("fields.name.invalid")),
        email: z.string().email(t("fields.email.invalid")),
        phone: z.string().min(10, t("fields.phone.invalid")),
        serviceType: z.string().min(1, t("fields.serviceType.invalid")),
        date: z.date({ error: t("fields.date.invalid") }),
        time: z.string().min(1, t("fields.time.invalid")),
        vehicleDetails: z.string().min(3, t("fields.vehicleDetails.invalid")),
        agreement: z.boolean().refine((value) => value === true, {
          message: t("fields.agreement.invalid"),
        }),
      }),
    [t]
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      serviceType: defaultService ?? "",
      time: "",
      vehicleDetails: "",
      agreement: false,
    },
  });

  const price = (amount: number) =>
    formatter.number(amount, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  async function onSubmit(values: FormValues) {
    try {
      const response = await fetch("/api/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: "car-wash",
          name: values.name,
          email: values.email,
          phone: values.phone,
          service: t(`services.${values.serviceType}` as "services.basic"),
          date: format(values.date, "yyyy-MM-dd"),
          time: values.time,
          vehicleDetails: values.vehicleDetails,
          locale,
        }),
      });

      if (!response.ok) throw new Error("request failed");

      toast.success(t("success"));
      setOpen(false);
      form.reset();
    } catch {
      toast.error(t("error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {label ?? t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.name.label")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("fields.name.placeholder")} {...field} />
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
                  <FormLabel>{t("fields.email.label")}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t("fields.email.placeholder")} {...field} />
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
                  <FormLabel>{t("fields.phone.label")}</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder={t("fields.phone.placeholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.serviceType.label")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("fields.serviceType.placeholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WASH_SERVICES.map((service) => (
                        <SelectItem key={service.key} value={service.key}>
                          {t(`services.${service.key}` as "services.basic")} ({price(service.price)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("fields.date.label")}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? formatter.dateTime(field.value, {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                              : t("fields.date.placeholder")}
                            <CalendarIcon className="ml-auto size-4 opacity-50" aria-hidden />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date() || date.getDay() === 0}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("fields.time.label")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("fields.time.placeholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WASH_TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="vehicleDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.vehicleDetails.label")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("fields.vehicleDetails.placeholder")} {...field} />
                  </FormControl>
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
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t("fields.agreement.label")}</FormLabel>
                    <FormDescription>{t("fields.agreement.description")}</FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
