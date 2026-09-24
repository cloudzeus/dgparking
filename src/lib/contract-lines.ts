/**
 * Γραμμές συμβάσεων — ανάγνωση χωρητικότητας και εγγραφή πινακίδων στο ERP.
 *
 * ΟΙ ΚΕΝΕΣ ΓΡΑΜΜΕΣ ΕΙΝΑΙ ΧΩΡΗΤΙΚΟΤΗΤΑ, ΟΧΙ ΣΚΟΥΠΙΔΙΑ
 * Στις ενεργές συμβάσεις υπάρχουν 189 γραμμές με `QTY=1, PRICE=0` και κανένα
 * είδος: θέσεις που δημιουργήθηκαν αλλά δεν τους αποδόθηκε ποτέ πινακίδα.
 * Όταν προστίθεται πινακίδα, ΣΥΜΠΛΗΡΩΝΟΥΜΕ πρώτα μια τέτοια γραμμή αντί να
 * προσθέσουμε καινούργια — αλλιώς η σύμβαση μεγαλώνει ενώ οι κενές μένουν για
 * πάντα εκεί.
 *
 * ΠΡΟΣΟΧΗ ΣΤΟ SETDATA
 * Το `INSTLINES` δεν είναι δικό του αντικείμενο· είναι πίνακας-παιδί του
 * `INST`. Το SoftOne ΔΙΑΓΡΑΦΕΙ κάθε γραμμή που δεν περιλαμβάνεται στο payload,
 * οπότε στέλνουμε ΠΑΝΤΑ ολόκληρο το σύνολο. Οι νέες γραμμές παίρνουν
 * LINENUM ≥ 9000001, όπως ορίζει το API.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { authenticateSoftOneAPI, setSoftOneData } from "@/lib/softone-api";

/** Το αντικείμενο μέσα από το οποίο γράφονται οι γραμμές. */
const INST_OBJECT = "INST";
/** Το SoftOne αναγνωρίζει τις νέες γραμμές από αυτό το κατώφλι. */
const NEW_LINE_BASE = 9000001;

export type ContractLineState = {
  inst: number;
  /** Οι κλεισμένες θέσεις της σύμβασης (`NUM01`). */
  slots: number | null;
  /** Γραμμές με πινακίδα. */
  filled: { linenum: number | null; mtrl: string; plate: string | null }[];
  /** Γραμμές χωρίς πινακίδα — διαθέσιμη χωρητικότητα. */
  emptyLines: { linenum: number | null }[];
};

function isEmptyMtrl(mtrl: string | null | undefined): boolean {
  const v = String(mtrl ?? "").trim();
  return v === "" || v === "0";
}

/** Η τρέχουσα εικόνα μιας σύμβασης: τι είναι γεμάτο και τι ελεύθερο. */
export async function getContractLineState(inst: number): Promise<ContractLineState | null> {
  const contract = await prisma.iNST.findUnique({
    where: { INST: inst },
    select: { INST: true, NUM01: true, lines: { select: { LINENUM: true, MTRL: true } } },
  });
  if (!contract) return null;

  const mtrls = contract.lines
    .map((l) => String(l.MTRL ?? "").trim())
    .filter((m) => !isEmptyMtrl(m));
  const items = mtrls.length
    ? await prisma.iTEMS.findMany({
        where: { MTRL: { in: mtrls } },
        select: { MTRL: true, CODE: true },
      })
    : [];
  const plateByMtrl = new Map(items.map((i) => [String(i.MTRL), (i.CODE ?? "").trim().toUpperCase()]));

  return {
    inst: contract.INST,
    slots: contract.NUM01 != null ? Number(contract.NUM01) : null,
    filled: contract.lines
      .filter((l) => !isEmptyMtrl(l.MTRL))
      .map((l) => ({
        linenum: l.LINENUM,
        mtrl: String(l.MTRL ?? "").trim(),
        plate: plateByMtrl.get(String(l.MTRL ?? "").trim()) ?? null,
      })),
    emptyLines: contract.lines.filter((l) => isEmptyMtrl(l.MTRL)).map((l) => ({ linenum: l.LINENUM })),
  };
}

async function erpAuth() {
  const company = Number(process.env.PARKING_COMPANY ?? 1002);
  const connection = await prisma.softOneConnection.findFirst({ where: { company } });
  if (!connection) throw new Error(`Δεν υπάρχει σύνδεση SoftOne για την εταιρία ${company}.`);

  const auth = await authenticateSoftOneAPI(
    connection.username,
    decrypt(connection.passwordEnc),
    String(connection.appId),
    String(connection.company),
    String(connection.branch),
    String(connection.module),
    String(connection.refid),
    undefined,
    connection.registeredName
  );
  if (!auth.success || !auth.clientID) throw new Error(auth.error || "Αποτυχία ταυτοποίησης SoftOne.");
  return { clientID: auth.clientID, appId: connection.appId };
}

export type WriteResult = {
  success: boolean;
  /** Πώς μπήκε η πινακίδα: συμπληρώθηκε κενή γραμμή ή προστέθηκε νέα. */
  mode?: "filled-empty" | "appended";
  error?: string;
};

/**
 * Προσθέτει πινακίδα σε σύμβαση, ΣΥΜΠΛΗΡΩΝΟΝΤΑΣ πρώτα κενή γραμμή αν υπάρχει.
 *
 * Το `mtrl` είναι ο κωδικός είδους, όχι η πινακίδα — η αντιστοίχιση γίνεται από
 * τον καλούντα, ώστε να αποτύχει νωρίς αν η πινακίδα δεν υπάρχει ως είδος.
 */
export async function addPlateToContract(inst: number, mtrl: string): Promise<WriteResult> {
  const state = await getContractLineState(inst);
  if (!state) return { success: false, error: "Η σύμβαση δεν βρέθηκε." };

  if (state.filled.some((l) => l.mtrl === mtrl)) {
    return { success: false, error: "Η πινακίδα υπάρχει ήδη στη σύμβαση." };
  }

  const lines = await prisma.iNSTLINES.findMany({
    where: { INST: inst },
    orderBy: { LINENUM: "asc" },
    select: { LINENUM: true, MTRL: true },
  });

  // Πρώτη κενή γραμμή — εκεί μπαίνει η πινακίδα.
  const targetIndex = lines.findIndex((l) => isEmptyMtrl(l.MTRL));
  const mode: WriteResult["mode"] = targetIndex >= 0 ? "filled-empty" : "appended";

  const payload: Record<string, unknown>[] = lines.map((l, i) => ({
    LINENUM: l.LINENUM,
    MTRL: i === targetIndex ? mtrl : l.MTRL,
  }));
  if (targetIndex < 0) {
    payload.push({ LINENUM: NEW_LINE_BASE, MTRL: mtrl });
  }

  try {
    const { clientID, appId } = await erpAuth();
    const result = await setSoftOneData(
      INST_OBJECT,
      String(inst),
      { INSTLINES: payload },
      clientID,
      appId,
      "2",
      undefined
    );
    if (!result.success) return { success: false, error: result.error ?? "Άγνωστο σφάλμα ERP." };
    return { success: true, mode };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Σφάλμα εγγραφής." };
  }
}

/**
 * Αφαιρεί πινακίδα από σύμβαση.
 *
 * Η γραμμή ΔΕΝ διαγράφεται — αδειάζει. Έτσι η χωρητικότητα της σύμβασης
 * παραμένει ίδια και η θέση μπορεί να δοθεί σε άλλο όχημα, που είναι ακριβώς
 * το νόημα των κενών γραμμών.
 */
export async function removePlateFromContract(inst: number, mtrl: string): Promise<WriteResult> {
  const lines = await prisma.iNSTLINES.findMany({
    where: { INST: inst },
    orderBy: { LINENUM: "asc" },
    select: { LINENUM: true, MTRL: true },
  });
  if (!lines.some((l) => String(l.MTRL ?? "").trim() === mtrl)) {
    return { success: false, error: "Η πινακίδα δεν βρέθηκε στη σύμβαση." };
  }

  const payload = lines.map((l) => ({
    LINENUM: l.LINENUM,
    MTRL: String(l.MTRL ?? "").trim() === mtrl ? "" : l.MTRL,
  }));

  try {
    const { clientID, appId } = await erpAuth();
    const result = await setSoftOneData(
      INST_OBJECT,
      String(inst),
      { INSTLINES: payload },
      clientID,
      appId,
      "2",
      undefined
    );
    if (!result.success) return { success: false, error: result.error ?? "Άγνωστο σφάλμα ERP." };
    return { success: true, mode: "filled-empty" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Σφάλμα εγγραφής." };
  }
}

/** Το είδος που αντιστοιχεί σε πινακίδα. Η πινακίδα είναι το `CODE` του είδους. */
export async function findMtrlForPlate(plate: string): Promise<string | null> {
  const item = await prisma.iTEMS.findFirst({
    where: { CODE: plate.trim().toUpperCase() },
    select: { MTRL: true },
  });
  return item?.MTRL ? String(item.MTRL).trim() : null;
}
