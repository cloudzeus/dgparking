/**
 * Χρέωση στάθμευσης — πιστή αναπαραγωγή του `calcPrice()` του SoftOne
 * (advanced JavaScript `Kolleris.SoTaskFunc`).
 *
 * ΣΚΟΠΟΣ ΦΑΣΗΣ 1: να παράγουμε ΤΑ ΙΔΙΑ ποσά με το ψηφιακό πελατολόγιο,
 * ξεκινώντας όμως από τις ώρες των καμερών αντί για τις χειρόγραφες του ERP.
 * Κάθε διαφορά ποσού πρέπει επομένως να οφείλεται σε διαφορά ΩΡΑΣ, όχι κανόνα.
 * Γι' αυτό ο αλγόριθμος αντιγράφεται όπως είναι — μαζί με τις ιδιοτροπίες του.
 *
 * Ο τιμοκατάλογος είναι σταθερός εδώ. Όταν φτιαχτεί η σελίδα διαχείρισης
 * τιμών, αρκεί να περνιέται ένα `Tariff` από τη βάση στη `calculateCharge`.
 */

/** Ο τιμοκατάλογος, με τα ονόματα που έχουν οι σταθερές στο SoftOne. */
export type Tariff = {
  /** Πάγιο πρώτης ώρας. Στο SoftOne: `hour = 4` → 1 ώρα = 1 + 4 = 5 €. */
  firstHourSurcharge: number;
  /** Πάνω από αυτό το ποσό σταματά η ωριαία κλίμακα. Στο SoftOne: `<= 10`. */
  hourlyCeiling: number;
  /** Χρέωση όταν ξεπεραστεί η κλίμακα και η έξοδος είναι την ίδια ημέρα. */
  sameDayRate: number;
  /** Χρέωση όταν ξεπεραστεί η κλίμακα και αλλάζει ημερολογιακή ημέρα. */
  overnightRate: number;
  /** Λεπτά χωρίς χρέωση στην αρχή. */
  freeMinutes: number;
};

/**
 * Δωρεάν χρόνος στην αρχή της στάθμευσης.
 *
 * Το ERP δεν το έχει στον τύπο του `calcPrice` — είναι πρακτική της πόρτας:
 * σύντομες στάσεις δεν χρεώνονται και συχνά δεν καταγράφονται καν στο ψηφιακό
 * πελατολόγιο. Στα δεδομένα 60 ημερών, 48 από τις 63 στάσεις κάτω των 15
 * λεπτών δεν χρεώθηκαν.
 *
 * Χωρίς αυτό, κάθε σύντομη στάση εμφανιζόταν ως χρέωση 5 € που «λείπει από το
 * ERP» — ψεύτικη απόκλιση και ψεύτικος διαφυγών τζίρος.
 */
export const FREE_MINUTES = 15;

export const DEFAULT_TARIFF: Tariff = {
  firstHourSurcharge: 4,
  hourlyCeiling: 10,
  sameDayRate: 12,
  overnightRate: 15,
  freeMinutes: FREE_MINUTES,
};

export type ChargeInput = {
  entry: Date;
  exit: Date;
  /** Αν η στάθμευση καλύπτεται από σύμβαση (SOACTION.INST > 0) δεν χρεώνεται. */
  hasContract?: boolean;
};

export type ChargeResult = {
  amount: number;
  /** Ώρες παραμονής, στρογγυλοποιημένες ΠΑΝΩ — κάθε ξεκινημένη ώρα χρεώνεται. */
  billedHours: number;
  /** Ανάλυση ανά 24ωρο, για να εξηγείται η τιμή σε email και στην αντιπαραβολή. */
  breakdown: { day: number; hours: number; rate: number; reason: string }[];
};

/**
 * Οι ημερομηνίες είναι «ρολόι τοίχου» (βλ. parking-time.ts), γι' αυτό τα μέρη
 * τους διαβάζονται με getUTC*.
 *
 * ΠΡΟΣΟΧΗ — διατηρημένη ιδιοτροπία του SoftOne:
 * η σύγκριση «άλλαξε μέρα;» γίνεται με `getDate()`, δηλαδή ΗΜΕΡΑ ΤΟΥ ΜΗΝΑ.
 * Σε στάθμευση ακριβώς 30/31 ημερών οι δύο ημερομηνίες μπορεί να πέσουν στην
 * ίδια ημέρα του μήνα και να χρεωθεί `sameDayRate` αντί για `overnightRate`.
 * Δεν το διορθώνουμε: στη φάση 1 θέλουμε ταύτιση με το ERP, όχι σωστότερο
 * αποτέλεσμα. Όταν συντονιστούμε, αυτό είναι το πρώτο που πρέπει να αλλάξει.
 */
export function calculateCharge(
  input: ChargeInput,
  tariff: Tariff = DEFAULT_TARIFF
): ChargeResult {
  const { entry, exit, hasContract = false } = input;

  if (hasContract) {
    return { amount: 0, billedHours: 0, breakdown: [] };
  }

  const ms = exit.getTime() - entry.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return { amount: 0, billedHours: 0, breakdown: [] };
  }

  // ΔΩΡΕΑΝ ΧΡΟΝΟΣ. Πρέπει να ελεγχθεί ΠΡΙΝ τη στρογγυλοποίηση ωρών: ο τύπος
  // ανεβάζει κάθε ξεκινημένη ώρα σε ολόκληρη, οπότε μια στάση οκτώ λεπτών θα
  // χρεωνόταν 5 €.
  const minutes = ms / 60_000;
  if (minutes <= tariff.freeMinutes) {
    return {
      amount: 0,
      billedHours: 0,
      breakdown: [
        {
          day: 0,
          hours: 0,
          rate: 0,
          reason: `εντός δωρεάν χρόνου (${Math.round(minutes)}′ από ${tariff.freeMinutes}′)`,
        },
      ],
    };
  }

  const billedHours = Math.ceil(ms / 3_600_000);

  let sum = 0;
  let surcharge = tariff.firstHourSurcharge;
  let remaining = billedHours;
  let day = 0;

  // Ο κέρσορας προχωράει μία ημέρα ανά επανάληψη, όπως το `d1.setDate(+1)`.
  const cursor = new Date(entry);
  const breakdown: ChargeResult["breakdown"] = [];

  while (remaining > 0) {
    day += 1;
    let rate: number;
    let reason: string;

    if (remaining + surcharge <= tariff.hourlyCeiling) {
      rate = remaining + surcharge;
      reason = surcharge
        ? `${remaining} ώρ. + ${surcharge} € πάγιο πρώτης ώρας`
        : `${remaining} ώρ. υπόλοιπο`;
    } else if (cursor.getUTCDate() !== exit.getUTCDate()) {
      rate = tariff.overnightRate;
      reason = "διανυκτέρευση (αλλάζει ημερολογιακή ημέρα)";
    } else {
      rate = tariff.sameDayRate;
      reason = "ημερήσια χρέωση (ίδια ημέρα, πάνω από την ωριαία κλίμακα)";
    }

    sum += rate;
    breakdown.push({ day, hours: Math.min(remaining, 24), rate, reason });

    surcharge = 0;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    remaining -= 24;
  }

  return { amount: sum, billedHours, breakdown };
}

/** Μονόγραμμη εξήγηση της χρέωσης — για email και για τη στήλη αντιπαραβολής. */
export function explainCharge(result: ChargeResult): string {
  if (result.amount === 0 && result.breakdown.length === 0) {
    return "Χωρίς χρέωση (σύμβαση ή μηδενική διάρκεια).";
  }
  const parts = result.breakdown.map(
    (b) => `ημέρα ${b.day}: ${b.rate} € — ${b.reason}`
  );
  return `${result.billedHours} χρεώσιμες ώρες · ${parts.join(" · ")} · σύνολο ${result.amount} €`;
}
