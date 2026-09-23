import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Testimonial = { name: string; role: string; content: string };

const STARS = 5;

/** Τι λένε οι πελάτες — τα τρία σχόλια του megaparking.gr. */
export async function TestimonialsSection() {
  const t = await getTranslations("testimonials");
  const items = t.raw("items") as Testimonial[];

  return (
    <section
      id="testimonials"
      className="border-t bg-muted/40 scroll-mt-20"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 id="testimonials-heading" className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("description")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map((testimonial) => (
            <Card key={testimonial.name} className="h-full">
              <CardContent className="flex h-full flex-col">
                <div className="flex gap-0.5" role="img" aria-label={t("rating", { stars: STARS })}>
                  {Array.from({ length: STARS }, (_, index) => (
                    <Star key={index} className="size-5 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                </div>

                <blockquote className="mt-4 flex-1 text-sm italic text-muted-foreground">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>

                <div className="mt-6">
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
