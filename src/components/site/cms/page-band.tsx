/**
 * Η μπλε ζώνη που ανοίγει κάθε δημόσια σελίδα — ίδια αντιμετώπιση με τις
 * σελίδες τιμών και πλυσίματος, ώστε το site να μοιάζει ένα.
 */
export function PageBand({
  title,
  description,
  headingId = "page-heading",
}: {
  title: string;
  description?: string | null;
  headingId?: string;
}) {
  return (
    <section className="border-b bg-mega-blue text-white" aria-labelledby={headingId}>
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:py-20">
        <h1 id={headingId} className="text-4xl font-bold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
