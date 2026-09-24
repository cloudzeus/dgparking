import type { CampaignStats, LabelledCount, TimelinePoint } from "@/lib/mailgun-analytics";

/** Ό,τι περνά ο server στη σελίδα στατιστικών — μόνο απλοί τύποι (χωρίς Date). */

export type RecipientRow = {
  email: string;
  delivered: boolean;
  opens: number;
  clicks: number;
  failed: boolean;
  lastActivity: string | null;
};

export type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: string | null;
  stats: CampaignStats;
  recipients: RecipientRow[];
};

/** Κάθε αποστολή, για τον επιλογέα και τη σύγκριση — ανεξάρτητα από το φίλτρο. */
export type CampaignOption = {
  id: string;
  name: string;
  sent: number;
  openRate: number;
};

export type NewsletterStatsView = {
  /** `null` = όλες οι αποστολές. */
  selectedCampaignId: string | null;
  options: CampaignOption[];
  totals: CampaignStats;
  campaigns: CampaignRow[];
  timeline: TimelinePoint[];
  topLinks: LabelledCount[];
  clients: LabelledCount[];
  devices: LabelledCount[];
  /** Υπάρχει έστω ένα συμβάν στη βάση. */
  hasEvents: boolean;
};

export type { CampaignStats, LabelledCount, TimelinePoint };
