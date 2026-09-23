import { getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = { question: string; answer: string };

/**
 * Συχνές ερωτήσεις — ίδιο περιεχόμενο με το παλιό `AnimatedFAQ`,
 * με το accordion του shadcn (προσβάσιμο, χωρίς δικό μας state).
 */
export async function PricesFaq() {
  const t = await getTranslations("prices.faq");
  const items = t.raw("items") as FaqItem[];

  return (
    <section className="bg-muted/40 py-16 sm:py-20" aria-labelledby="prices-faq-heading">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="text-center">
          <h2 id="prices-faq-heading" className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("description")}</p>
        </div>

        <Accordion type="single" collapsible className="mt-10 w-full">
          {items.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
