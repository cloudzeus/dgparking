import Image from "next/image";
import { ArrowRight, Newspaper } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type NewsCardProps = {
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  /** Η ημερομηνία γραμμένη στη γλώσσα της σελίδας. */
  dateLabel?: string | null;
  /** Η ίδια ημερομηνία σε μορφή μηχανής, για το `<time datetime>`. */
  dateTime?: string | null;
  readMoreLabel: string;
  /** Η πρώτη κάρτα φορτώνει νωρίς — είναι ό,τι βλέπει πρώτο ο επισκέπτης. */
  priority?: boolean;
};

/** Μία είδηση στο πλέγμα του καταλόγου. */
export function NewsCard({
  slug,
  title,
  excerpt,
  coverImageUrl,
  dateLabel,
  dateTime,
  readMoreLabel,
  priority = false,
}: NewsCardProps) {
  const href = `/news/${slug}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          // Χωρίς εξώφυλλο η κάρτα κρατά το σχήμα της — δεν «πέφτει» το πλέγμα.
          <div className="flex h-full w-full items-center justify-center" aria-hidden>
            <Newspaper className="size-10 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {dateLabel ? (
          <time
            dateTime={dateTime ?? undefined}
            className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
          >
            {dateLabel}
          </time>
        ) : null}

        <h2 className="text-lg font-semibold leading-snug text-foreground">
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </h2>

        {excerpt ? <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt}</p> : null}

        <Link
          href={href}
          className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-mega-red hover:underline"
        >
          {readMoreLabel}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </article>
  );
}
