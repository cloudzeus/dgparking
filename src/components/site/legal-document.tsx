import { getTranslations } from "next-intl/server";

type LegalDocument = "privacyPolicy" | "termsOfService";

type Section = { title: string; content: string[] };

/**
 * Το σώμα ενός νομικού κειμένου (πολιτική απορρήτου / όροι χρήσης) ως
 * κανονική σελίδα. Το περιεχόμενο είναι το ίδιο που δείχνει και το
 * το παλιό modal — μία πηγή, το `legal.json` ανά γλώσσα.
 */
export async function LegalDocument({ document }: { document: LegalDocument }) {
  const t = await getTranslations(`legal.${document}`);
  const sections = t.raw("sections") as Record<string, Section>;

  return (
    <div className="flex flex-col gap-8">
      {Object.entries(sections).map(([key, section]) => (
        <section key={key} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground">
            {section.content.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
