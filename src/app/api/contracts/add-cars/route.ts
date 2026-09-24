import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI, setSoftOneData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";

/**
 * POST /api/contracts/add-cars
 * Add license plates (INSTLINES) to a contract (INST) and sync to ERP
 */
/** Το αντικείμενο των εγκαταστάσεων — οι γραμμές γράφονται μέσα από αυτό. */
const INST_OBJECT = "INST";
/** Νέα γραμμή σε πίνακα-παιδί: LINENUM ≥ 9000001 (κανόνας του Soft1). */
const NEW_LINE_BASE = 9000001;

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { instId, mtrlList, syncToErp } = body;

    if (!instId) {
      return NextResponse.json(
        { success: false, error: "instId is required" },
        { status: 400 }
      );
    }

    if (!mtrlList || !Array.isArray(mtrlList) || mtrlList.length === 0) {
      return NextResponse.json(
        { success: false, error: "mtrlList (array of MTRL values) is required" },
        { status: 400 }
      );
    }

    // Verify INST exists
    const inst = await prisma.iNST.findUnique({
      where: { INST: instId },
    });

    if (!inst) {
      return NextResponse.json(
        { success: false, error: "Contract (INST) not found" },
        { status: 404 }
      );
    }

    // Verify INST has TRDR (customer)
    if (!inst.TRDR || inst.TRDR.trim() === '') {
      return NextResponse.json(
        { success: false, error: "Contract must have a customer (TRDR) before adding license plates" },
        { status: 400 }
      );
    }

    // ΔΕΝ περιορίζουμε το πλήθος των δηλωμένων πινακίδων από το NUM01.
    //
    // Το NUM01 είναι οι ΘΕΣΕΙΣ που έχει κλείσει ο πελάτης, όχι πόσα οχήματα
    // επιτρέπεται να δηλώσει: με 2 θέσεις μπορεί κάλλιστα να δηλώσει 10
    // πινακίδες. Υπέρβαση υπάρχει μόνο όταν βρεθούν ΤΑΥΤΟΧΡΟΝΑ μέσα
    // περισσότερα οχήματα από τις θέσεις — αυτό το δείχνει το dashboard και
    // η λίστα συμβολαίων, δεν το μπλοκάρει η καταχώριση.

    // Get the next INSTLINES ID (max + 1)
    const maxInstLines = await prisma.iNSTLINES.findFirst({
      orderBy: { INSTLINES: "desc" },
      select: { INSTLINES: true },
    });

    let nextInstLinesId = (maxInstLines?.INSTLINES || 0) + 1;

    // Get max LINENUM for this INST
    const maxLineNum = await prisma.iNSTLINES.findFirst({
      where: { INST: instId },
      orderBy: { LINENUM: "desc" },
      select: { LINENUM: true },
    });

    let nextLineNum = (maxLineNum?.LINENUM || 0) + 1;

    // Only authenticate with ERP if syncToErp is true
    let instLinesIntegration: any = null;
    let authResult: any = null;
    // Το έγκυρο αντικείμενο είναι το `INST`· το `INSTLINES` είναι ο πίνακας.
    let objectName = INST_OBJECT;
    let reverseMappings: Record<string, string> = {};

    if (syncToErp) {
      // Find INSTLINES integration
      const allIntegrations = await prisma.softOneIntegration.findMany({
        where: {
          userId: session.user.id,
        },
        include: { connection: true },
      });

      instLinesIntegration = allIntegrations.find((integration) => {
        const config = integration.configJson as any;
        return config?.modelMapping?.modelName === "INSTLINES";
      });

      if (!instLinesIntegration) {
        return NextResponse.json(
          { success: false, error: "INSTLINES integration not found. Please configure it in Integrations." },
          { status: 404 }
        );
      }

      const config = instLinesIntegration.configJson as any;
      const modelMapping = config?.modelMapping || {};
      const { fieldMappings } = modelMapping;

      if (!fieldMappings) {
        return NextResponse.json(
          { success: false, error: "INSTLINES integration not properly configured" },
          { status: 400 }
        );
      }

      // Build reverse mappings (model field name → ERP field name)
      Object.entries(fieldMappings as Record<string, string>).forEach(([erpFieldName, modelFieldName]) => {
        if (typeof modelFieldName === "string" && modelFieldName !== "none") {
          reverseMappings[modelFieldName] = erpFieldName;
        }
      });

      // Authenticate with SoftOne
      const password = decrypt(instLinesIntegration.connection.passwordEnc);
      authResult = await authenticateSoftOneAPI(
        instLinesIntegration.connection.username,
        password,
        String(instLinesIntegration.connection.appId),
        String(instLinesIntegration.connection.company),
        String(instLinesIntegration.connection.branch),
        String(instLinesIntegration.connection.module),
        String(instLinesIntegration.connection.refid),
        undefined,
        instLinesIntegration.connection.registeredName
      );

      if (!authResult.success || !authResult.clientID) {
        return NextResponse.json(
          { success: false, error: "Failed to authenticate with SoftOne" },
          { status: 401 }
        );
      }

      objectName = instLinesIntegration.objectName || INST_OBJECT;
    }
    const createdInstLines: any[] = [];
    const errors: string[] = [];
    // Το SoftOne αναγνωρίζει τις νέες γραμμές από LINENUM ≥ 9000001.
    let newLineOffset = 0;

    // Create INSTLINES for each MTRL
    for (const mtrl of mtrlList) {
      try {
        // Verify ITEM exists
        const mtrlNum = Number(String(mtrl).replace(/^0+/, '') || '0');
        const item = await prisma.iTEMS.findUnique({
          where: { ITEMS: mtrlNum },
        });

        if (!item) {
          errors.push(`Item with MTRL ${mtrl} not found`);
          continue;
        }

        // Check if INSTLINES already exists for this INST + MTRL
        const existing = await prisma.iNSTLINES.findFirst({
          where: {
            INST: instId,
            MTRL: String(mtrl).toUpperCase(),
          },
        });

        if (existing) {
          errors.push(`License plate ${mtrl} already exists in this contract`);
          continue;
        }

        // Prepare data for ERP (only if syncing)
        const erpData: any = {};

        // Το κλειδί της γραμμής (`INSTLINES`) και το `LINENUM` τα ορίζει το
        // SoftOne όταν γράφουμε μέσω του γονέα — δεν τα στέλνουμε εμείς.
        erpData[reverseMappings["MTRL"] || "MTRL"] = String(mtrl).toUpperCase();
        
        // Set optional fields from INST
        if (inst.TRDBRANCH && reverseMappings["TRDBRANCH"]) {
          erpData[reverseMappings["TRDBRANCH"]] = inst.TRDBRANCH;
        }
        if (inst.BUSUNITS && reverseMappings["BUSUNITS"]) {
          erpData[reverseMappings["BUSUNITS"]] = inst.BUSUNITS;
        }

        // Create in SoftOne first (only if syncToErp is true)
        //
        // Οι γραμμές ΔΕΝ είναι δικό τους αντικείμενο: το `INSTLINES` είναι
        // πίνακας-παιδί του αντικειμένου `INST`. Γράφουμε λοιπόν στο `INST`
        // με KEY το συμβόλαιο και data κλειδωμένα στο όνομα του πίνακα.
        //
        // ΠΡΟΣΟΧΗ: το SoftOne διαγράφει κάθε υπάρχουσα γραμμή που ΔΕΝ
        // περιλαμβάνεται στο payload. Γι' αυτό στέλνουμε ΟΛΕΣ τις γραμμές του
        // συμβολαίου (διαβασμένες πριν την εγγραφή) και προσθέτουμε τη νέα με
        // LINENUM ≥ 9000001, όπως ορίζει το API για νέες γραμμές.
        let softOneId: number | undefined;
        if (syncToErp) {
          const existingLines = await prisma.iNSTLINES.findMany({
            where: { INST: instId },
            orderBy: { LINENUM: "asc" },
          });

          const lines: Record<string, unknown>[] = existingLines.map((line) => ({
            LINENUM: line.LINENUM,
            MTRL: line.MTRL,
          }));
          lines.push({ ...erpData, LINENUM: NEW_LINE_BASE + newLineOffset });

          const setDataResult = await setSoftOneData(
            INST_OBJECT,
            String(instId), // KEY = το συμβόλαιο· η γραμμή είναι παιδί του
            { INSTLINES: lines },
            authResult.clientID,
            instLinesIntegration.connection.appId,
            "2", // VERSION 2
            undefined
          );

          if (!setDataResult.success) {
            errors.push(`Failed to create ${mtrl} in ERP: ${setDataResult.error}`);
            continue;
          }
          newLineOffset++;
          softOneId = setDataResult.id != null
            ? Number(String(setDataResult.id).replace(/^0+/, '') || 0)
            : undefined;
        }

        // Use the ID returned from SoftOne if available, otherwise use local next id
        const instLinesId = softOneId ?? nextInstLinesId;

        // Create in our database
        const newInstLine = await prisma.iNSTLINES.create({
          data: {
            INSTLINES: instLinesId,
            INST: instId,
            LINENUM: nextLineNum,
            MTRL: String(mtrl).toUpperCase(),
            TRDBRANCH: inst.TRDBRANCH,
            BUSUNITS: inst.BUSUNITS,
          },
        });

        createdInstLines.push(newInstLine);
        nextInstLinesId = Math.max(nextInstLinesId, instLinesId) + 1;
        nextLineNum++;
      } catch (error: any) {
        console.error(`[API] Error creating INSTLINES for MTRL ${mtrl}:`, error);
        errors.push(`Failed to create ${mtrl}: ${error.message || error}`);
      }
    }

    return NextResponse.json({
      success: true,
      created: createdInstLines.length,
      errors: errors.length,
      instLines: createdInstLines,
      errorMessages: errors,
    });
  } catch (error: any) {
    console.error("[API] Error adding cars to contract:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add cars to contract" },
      { status: 500 }
    );
  }
}
