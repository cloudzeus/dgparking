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
  /** Πού βρίσκονται οι παραλήπτες που άνοιξαν. */
  geo: LabelledCount[];
  /** Ανοίγματα ανά ώρα της ημέρας — πότε να φύγει το επόμενο δελτίο. */
  byHour: { hour: number; opens: number }[];
  /** Πόσο γρήγορα ανοίγεται ένα δελτίο μετά την παράδοση. */
  timeToOpen: LabelledCount[];
  /** Τι ακριβώς πήγε στραβά στις αποτυχίες. */
  failures: LabelledCount[];
  /** Η πορεία της λίστας στον χρόνο. */
  growth: { month: string; subscribed: number; unsubscribed: number }[];
  /** Η σύνθεση της λίστας τώρα. */
  mix: LabelledCount[];
  /** Υπάρχει έστω ένα συμβάν στη βάση. */
  hasEvents: boolean;
};

export type { CampaignStats, LabelledCount, TimelinePoint };
