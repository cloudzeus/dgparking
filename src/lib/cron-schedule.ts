/**
 * Χρονοπρογραμματισμός ενσωματώσεων SoftOne — κοινή γλώσσα για όλη την εφαρμογή.
 *
 * Το `configJson.schedule` κάθε ενσωμάτωσης κρατά `{ type, presetSchedule,
 * cronExpression, scheduleDay, scheduleTime }`. Εδώ ζει ό,τι χρειάζεται για να
 * διαβαστεί αυτό το αντικείμενο στα ελληνικά, να μετατραπεί σε έκφραση cron και
 * να κριθεί αν μια εργασία καθυστερεί.
 *
 * Καθαρές συναρτήσεις χωρίς εξαρτήσεις — τρέχουν και σε server και σε client.
 */

export const WEEKDAYS_EL = [
  "Κυριακή",
  "Δευτέρα",
  "Τρίτη",
  "Τετάρτη",
  "Πέμπτη",
  "Παρασκευή",
  "Σάββατο",
] as const;

export type ScheduleType = "preset" | "custom";

/** Το σχήμα του `configJson.schedule` όπως το γράφει ο οδηγός ενσωμάτωσης. */
export type IntegrationSchedule = {
  type?: string | null;
  presetSchedule?: string | null;
  cronExpression?: string | null;
  scheduleDay?: string | null;
  scheduleTime?: string | null;
};

export type SchedulePresetId =
  | "every-1-min"
  | "every-5-min"
  | "every-15-min"
  | "every-30-min"
  | "hourly"
  | "every-6-hours"
  | "every-12-hours"
  | "daily"
  | "weekly";

type Preset = {
  id: SchedulePresetId;
  label: string;
  /** Διάστημα σε χιλιοστά του δευτερολέπτου — για τον έλεγχο καθυστέρησης. */
  intervalMs: number;
  needsTime?: boolean;
  needsDay?: boolean;
  /** Κρυφά από τον επιλογέα, αλλά αναγνωρίσιμα σε παλιές ενσωματώσεις. */
  legacy?: boolean;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Όλες οι γνωστές συχνότητες, με τη σειρά που εμφανίζονται στον επιλογέα. */
export const SCHEDULE_PRESETS: readonly Preset[] = [
  { id: "every-1-min", label: "Κάθε λεπτό", intervalMs: MINUTE },
  { id: "every-5-min", label: "Κάθε 5 λεπτά", intervalMs: 5 * MINUTE },
  { id: "every-15-min", label: "Κάθε 15 λεπτά", intervalMs: 15 * MINUTE, legacy: true },
  { id: "every-30-min", label: "Κάθε 30 λεπτά", intervalMs: 30 * MINUTE },
  { id: "hourly", label: "Ωριαία", intervalMs: HOUR },
  { id: "every-6-hours", label: "Κάθε 6 ώρες", intervalMs: 6 * HOUR, legacy: true },
  { id: "every-12-hours", label: "Κάθε 12 ώρες", intervalMs: 12 * HOUR },
  { id: "daily", label: "Ημερήσια", intervalMs: DAY, needsTime: true },
  { id: "weekly", label: "Εβδομαδιαία", intervalMs: 7 * DAY, needsTime: true, needsDay: true },
] as const;

/** Οι συχνότητες που προσφέρονται σε νέα επιλογή (χωρίς τις παλιές). */
export const SELECTABLE_PRESETS = SCHEDULE_PRESETS.filter((p) => !p.legacy);

export function findPreset(id: string | null | undefined): Preset | undefined {
  if (!id) return undefined;
  return SCHEDULE_PRESETS.find((p) => p.id === id);
}

/** Ώρα «HH:MM» → [ώρες, λεπτά] με ασφαλή προεπιλογή 09:00. */
function splitTime(time: string | null | undefined): [string, string] {
  const [rawHours, rawMinutes] = (time ?? "09:00").split(":");
  const hours = String(Number.parseInt(rawHours ?? "9", 10) || 0);
  const minutes = String(Number.parseInt(rawMinutes ?? "0", 10) || 0);
  return [hours, minutes];
}

/** Συχνότητα + ώρα/ημέρα → έκφραση cron (ίδια λογική με τον οδηγό ενσωμάτωσης). */
export function cronFromPreset(
  preset: SchedulePresetId,
  scheduleTime?: string | null,
  scheduleDay?: string | null
): string {
  switch (preset) {
    case "every-1-min":
      return "*/1 * * * *";
    case "every-5-min":
      return "*/5 * * * *";
    case "every-15-min":
      return "*/15 * * * *";
    case "every-30-min":
      return "*/30 * * * *";
    case "hourly":
      return "0 * * * *";
    case "every-6-hours":
      return "0 */6 * * *";
    case "every-12-hours":
      return "0 */12 * * *";
    case "daily": {
      const [hours, minutes] = splitTime(scheduleTime);
      return `${minutes} ${hours} * * *`;
    }
    case "weekly": {
      const [hours, minutes] = splitTime(scheduleTime);
      const day = String(Number.parseInt(scheduleDay ?? "1", 10) || 0);
      return `${minutes} ${hours} * * ${day}`;
    }
    default:
      return "0 * * * *";
  }
}

/**
 * Ίδια κανονικοποίηση με το `cron-manager`: κενά γύρω από την κάθετο φεύγουν και συμπληρώνεται
 * το πεδίο ημέρας εβδομάδας όταν λείπει.
 */
export function normalizeCronExpression(expression: string): string {
  const cleaned = expression.trim().replace(/\*\s*\/\s*/g, "*/");
  const fields = cleaned.split(/\s+/).filter(Boolean);
  if (fields.length === 4) return `${fields.join(" ")} *`;
  return fields.join(" ");
}

const FIELD_LIMITS: ReadonlyArray<{ min: number; max: number }> = [
  { min: 0, max: 59 }, // λεπτό
  { min: 0, max: 23 }, // ώρα
  { min: 1, max: 31 }, // ημέρα μήνα
  { min: 1, max: 12 }, // μήνας
  { min: 0, max: 7 }, // ημέρα εβδομάδας
];

function isValidField(field: string, limit: { min: number; max: number }): boolean {
  return field.split(",").every((part) => {
    const [range, step] = part.split("/");
    if (step !== undefined && !/^\d+$/.test(step)) return false;
    if (step !== undefined && Number.parseInt(step, 10) < 1) return false;
    if (range === "*") return true;
    const bounds = range.split("-");
    if (bounds.length > 2) return false;
    return bounds.every((value) => {
      if (!/^\d+$/.test(value)) return false;
      const n = Number.parseInt(value, 10);
      return n >= limit.min && n <= limit.max;
    });
  });
}

/** Έλεγχος έκφρασης cron 5 πεδίων, χωρίς εξάρτηση από το node-cron. */
export function isValidCronExpression(expression: string): boolean {
  const fields = normalizeCronExpression(expression).split(" ").filter(Boolean);
  if (fields.length !== 5) return false;
  return fields.every((field, index) => isValidField(field, FIELD_LIMITS[index]));
}

/** Μία έκφραση cron σε απλά ελληνικά — π.χ. «κάθε 30 λεπτά», «Κάθε Δευτέρα 09:00». */
export function describeCron(expression: string | null | undefined): string {
  if (!expression) return "Χωρίς προγραμματισμό";

  const fields = normalizeCronExpression(expression).split(" ").filter(Boolean);
  if (fields.length !== 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const everyDate = dayOfMonth === "*" && month === "*";
  const at = (h: string, m: string) => `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;

  if (everyDate && dayOfWeek === "*") {
    // Κάθε Ν λεπτά
    if (minute.startsWith("*/") && hour === "*") {
      const step = minute.slice(2);
      return step === "1" ? "Κάθε λεπτό" : `Κάθε ${step} λεπτά`;
    }
    // Κάθε λεπτό
    if (minute === "*" && hour === "*") return "Κάθε λεπτό";
    // Κάθε Ν ώρες
    if (/^\d+$/.test(minute) && hour.startsWith("*/")) {
      const step = hour.slice(2);
      const suffix = minute === "0" ? "" : ` και ${minute} λεπτά`;
      return step === "1" ? `Κάθε ώρα${suffix}` : `Κάθε ${step} ώρες${suffix}`;
    }
    // Ωριαία
    if (/^\d+$/.test(minute) && hour === "*") {
      return minute === "0" ? "Κάθε ώρα" : `Κάθε ώρα στο λεπτό ${minute}`;
    }
    // Ημερήσια
    if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
      return `Κάθε μέρα ${at(hour, minute)}`;
    }
  }

  // Εβδομαδιαία
  if (everyDate && /^\d+$/.test(dayOfWeek) && /^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    const index = Number.parseInt(dayOfWeek, 10) % 7;
    return `Κάθε ${WEEKDAYS_EL[index]} ${at(hour, minute)}`;
  }

  return expression;
}

/** Ολόκληρο το `schedule` σε απλά ελληνικά. */
export function describeSchedule(schedule: IntegrationSchedule | null | undefined): string {
  if (!schedule) return "Χωρίς προγραμματισμό";

  const preset = findPreset(schedule.presetSchedule);
  if (preset) {
    if (preset.id === "daily" && schedule.scheduleTime) {
      return `Κάθε μέρα ${schedule.scheduleTime}`;
    }
    if (preset.id === "weekly") {
      const index = Number.parseInt(schedule.scheduleDay ?? "1", 10) % 7;
      const day = WEEKDAYS_EL[Number.isNaN(index) ? 1 : index];
      return schedule.scheduleTime ? `Κάθε ${day} ${schedule.scheduleTime}` : `Κάθε ${day}`;
    }
    return preset.label;
  }

  return describeCron(schedule.cronExpression);
}

/** Πόσο συχνά τρέχει η εργασία, σε χιλιοστά — `null` αν δεν αναγνωρίζεται. */
export function scheduleIntervalMs(schedule: IntegrationSchedule | null | undefined): number | null {
  if (!schedule) return null;

  const preset = findPreset(schedule.presetSchedule);
  if (preset) return preset.intervalMs;

  const expression = schedule.cronExpression;
  if (!expression) return null;

  const fields = normalizeCronExpression(expression).split(" ").filter(Boolean);
  if (fields.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (dayOfMonth !== "*" || month !== "*") return null;

  if (dayOfWeek === "*") {
    if (minute === "*") return MINUTE;
    if (minute.startsWith("*/") && hour === "*") {
      const step = Number.parseInt(minute.slice(2), 10);
      return Number.isFinite(step) && step > 0 ? step * MINUTE : null;
    }
    if (/^\d+$/.test(minute) && hour === "*") return HOUR;
    if (/^\d+$/.test(minute) && hour.startsWith("*/")) {
      const step = Number.parseInt(hour.slice(2), 10);
      return Number.isFinite(step) && step > 0 ? step * HOUR : null;
    }
    if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) return DAY;
    return null;
  }

  if (/^\d+$/.test(dayOfWeek)) return 7 * DAY;
  return null;
}

export type SyncHealth = {
  /** `ok` = μέσα στον χρόνο του, `overdue` = πέρασε η ώρα του, `never` = δεν έτρεξε ποτέ. */
  state: "ok" | "overdue" | "never" | "inactive" | "unscheduled" | "unknown";
  label: string;
  /** Μία φράση: τι συμβαίνει και τι σημαίνει. */
  hint: string;
};

/**
 * Πόσο ανεκτικοί είμαστε: μέχρι τρία χαμένα ραντεβού (και τουλάχιστον 15 λεπτά
 * χάρη) πριν πούμε ότι η εργασία καθυστερεί.
 */
function overdueThresholdMs(intervalMs: number): number {
  return Math.max(3 * intervalMs, intervalMs + 15 * MINUTE);
}

/** Πόσος καιρός πέρασε, σε ελληνικά («πριν 4 ημέρες»). */
export function formatAgo(from: Date | null | undefined, now: Date = new Date()): string {
  if (!from) return "Ποτέ";
  const diff = now.getTime() - from.getTime();
  if (diff < MINUTE) return "μόλις τώρα";
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `πριν ${minutes} ${minutes === 1 ? "λεπτό" : "λεπτά"}`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `πριν ${hours} ${hours === 1 ? "ώρα" : "ώρες"}`;
  }
  const days = Math.floor(diff / DAY);
  if (days < 31) return `πριν ${days} ${days === 1 ? "ημέρα" : "ημέρες"}`;
  const months = Math.floor(days / 30);
  return `πριν ${months} ${months === 1 ? "μήνα" : "μήνες"}`;
}

/**
 * Η ειλικρινής εικόνα μιας εργασίας: ενεργή μεν, αλλά έτρεξε ποτέ; και αν ναι,
 * μέσα στον χρόνο που ορίζει το δικό της πρόγραμμα;
 */
export function evaluateSyncHealth(input: {
  isActive: boolean;
  lastSyncAt: Date | null;
  schedule: IntegrationSchedule | null | undefined;
  now?: Date;
}): SyncHealth {
  const now = input.now ?? new Date();
  const intervalMs = scheduleIntervalMs(input.schedule);
  const description = describeSchedule(input.schedule);

  if (!input.isActive) {
    return {
      state: "inactive",
      label: "Ανενεργή",
      hint: "Η ενσωμάτωση είναι κλειστή — δεν προγραμματίζεται καμία εκτέλεση.",
    };
  }

  if (!input.schedule?.cronExpression && !input.schedule?.presetSchedule) {
    return {
      state: "unscheduled",
      label: "Χωρίς πρόγραμμα",
      hint: "Δηλώνεται ενεργή αλλά δεν έχει έκφραση cron, οπότε δεν τρέχει ποτέ. Όρισε συχνότητα.",
    };
  }

  if (!input.lastSyncAt) {
    return {
      state: "never",
      label: "Δεν έτρεξε ποτέ",
      hint: `Ενεργή με πρόγραμμα «${description}», αλλά δεν υπάρχει καμία επιτυχημένη εκτέλεση. Δοκίμασε «Εκτέλεση τώρα».`,
    };
  }

  if (intervalMs === null) {
    return {
      state: "unknown",
      label: "Άγνωστη συχνότητα",
      hint: `Η έκφραση cron δεν αναγνωρίζεται, οπότε δεν μπορεί να ελεγχθεί η καθυστέρηση. Τελευταίος συγχρονισμός ${formatAgo(input.lastSyncAt, now)}.`,
    };
  }

  const elapsed = now.getTime() - input.lastSyncAt.getTime();
  if (elapsed > overdueThresholdMs(intervalMs)) {
    return {
      state: "overdue",
      label: "Καθυστερεί",
      hint: `Θα έπρεπε να τρέχει «${description}», αλλά ο τελευταίος συγχρονισμός ήταν ${formatAgo(input.lastSyncAt, now)}. Η εργασία έχει κολλήσει — έλεγξε τη σύνδεση SoftOne και κάνε «Επανεκκίνηση όλων».`,
    };
  }

  return {
    state: "ok",
    label: "Εντάξει",
    hint: `Τρέχει «${description}» και ο τελευταίος συγχρονισμός ήταν ${formatAgo(input.lastSyncAt, now)}.`,
  };
}
