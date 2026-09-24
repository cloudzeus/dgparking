"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { syncNewsletterStats } from "@/app/(app)/newsletter/stats/actions";

/** «Ανανέωση από Mailgun»: κατεβάζει τα συμβάντα και ξαναφορτώνει τη σελίδα. */
export function StatsSyncButton({ campaignId }: { campaignId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await syncNewsletterStats(campaignId ?? undefined);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Button onClick={refresh} disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <RefreshCw />}
      Ανανέωση από Mailgun
    </Button>
  );
}
