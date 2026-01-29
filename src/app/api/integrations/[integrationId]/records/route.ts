import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI, setSoftOneData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";

/**
 * POST /api/integrations/[integrationId]/records
 * Create a new record for an integration
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ADMIN can use any integration; others only their own
    const integration = await prisma.softOneIntegration.findFirst({
      where:
        session.user.role === "ADMIN"
          ? { id: integrationId }
          : { id: integrationId, userId: session.user.id },
      include: { connection: true },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const config = integration.configJson as any;
    const modelMapping = config?.modelMapping || {};
    const { modelName, fieldMappings, uniqueIdentifier, syncDirection } = modelMapping;
    const { erpField, modelField } = uniqueIdentifier || {};

    if (!modelName) {
      return NextResponse.json(
        { success: false, error: "Model mapping not configured" },
        { status: 400 }
      );
    }

    // Get the model dynamically
    const model = (prisma as any)[modelName];
    if (!model) {
      return NextResponse.json(
        { success: false, error: `Model ${modelName} not found` },
        { status: 400 }
      );
    }

    // Generate 8-digit random CODE for new CUSTORMER records if not provided
    const recordData = { ...body };
    if (modelName === "CUSTORMER" && !recordData.CODE) {
      recordData.CODE = Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    // Use default AFM value 99999999 if not provided for CUSTORMER
    if (modelName === "CUSTORMER" && (!recordData.AFM || recordData.AFM.trim() === "")) {
      recordData.AFM = "99999999";
    }

    // Add prefix "ΠΕΛΑΤΗΣ ΛΙΑΝΙΚΗΣ-" to NAME if AFM is default or empty
    if (modelName === "CUSTORMER" && recordData.NAME) {
      const nameValue = String(recordData.NAME).trim();
      const prefix = "ΠΕΛΑΤΗΣ ΛΙΑΝΙΚΗΣ-";
      const hasValidAFM = recordData.AFM && recordData.AFM.trim() !== "" && recordData.AFM !== "99999999";
      
      // Add prefix if NAME doesn't already have it and AFM is default/empty
      if (!nameValue.startsWith(prefix) && !hasValidAFM) {
        recordData.NAME = prefix + nameValue;
      }
    }

    // Set default COUNTRY to ΕΛΛΑΔΑ (Greece) if not provided for CUSTORMER
    if (modelName === "CUSTORMER" && !recordData.COUNTRY) {
      // Find Greece country code - fetch all and filter in memory for case-insensitive search
      const countryModel = (prisma as any).COUNTRY;
      if (countryModel) {
        const allCountries = await countryModel.findMany({
          select: {
            COUNTRY: true,
            NAME: true,
          },
        });

        // Find Greece by name (case-insensitive)
        const greeceCountry = allCountries.find((c: any) => {
          const name = (c.NAME || "").toLowerCase();
          return name.includes("ελλάδα") || 
                 name.includes("greece") || 
                 name.includes("ellada");
        });

        if (greeceCountry) {
          recordData.COUNTRY = String(greeceCountry.COUNTRY);
        }
      }
    }

    // Check if AFM already exists for CUSTORMER (only if not default value)
    if (modelName === "CUSTORMER" && recordData.AFM && recordData.AFM !== "99999999") {
      const existingCustomer = await model.findFirst({
        where: {
          AFM: recordData.AFM,
        },
        select: {
          id: true,
          NAME: true,
          AFM: true,
        },
      });

      if (existingCustomer) {
        return NextResponse.json(
          {
            success: false,
            error: `AFM ${recordData.AFM} already exists for customer: ${existingCustomer.NAME || "Unknown"}`,
          },
          { status: 400 }
        );
      }
    }

    // For two-way sync, create in SoftOne ERP first, then save to our database
    if (syncDirection === "two-way" && fieldMappings) {
      try {
        // Authenticate with SoftOne
        const connection = integration.connection;
        const password = decrypt(connection.passwordEnc);

        const authResult = await authenticateSoftOneAPI(
          connection.username,
          password,
          String(connection.appId),
          String(connection.company),
          String(connection.branch),
          String(connection.module),
          String(connection.refid),
          undefined,
          connection.registeredName
        );

        if (!authResult.success || !authResult.clientID) {
          return NextResponse.json(
            { success: false, error: "Failed to authenticate with SoftOne" },
            { status: 401 }
          );
        }

        // Create reverse field mappings (modelField -> erpField)
        // For create: exclude only truly auto-generated fields (CODE is generated by us, not SoftOne)
        const autoGeneratedFields = ["INSDATE", "UPDDATE", "createdAt", "updatedAt", "SODTYPE", "id", "TRDR", "MTRL", "CODE"];
        const reverseMappings: Record<string, string> = {};
        Object.entries(fieldMappings).forEach(([erpFieldName, modelFieldName]: [string, any]) => {
          if (autoGeneratedFields.includes(erpFieldName)) return;
          if (modelFieldName && modelFieldName !== "none" && modelFieldName.trim() !== "") {
            reverseMappings[modelFieldName] = erpFieldName;
          }
        });

        // Transform data to SoftOne format
        const softOneData: Record<string, any[]> = {};
        const objectData: any = {};

        Object.entries(reverseMappings).forEach(([modelFieldName, erpFieldName]) => {
          if (autoGeneratedFields.includes(erpFieldName)) return;
          
          const value = recordData[modelFieldName];
          if (value !== null && value !== undefined) {
            const intFields = ["COUNTRY", "SOCURRENCY", "ISACTIVE", "VAT", "VATS1", "VATS3", 
              "MYDATACODE", "DEPART", "ACNMSKS", "ACNMSKX", "LOCKID", "TRDCATEGORY", "SODTYPE", "ITEMS",
              "PAYMENT", "ISDOSE", "INSTALMENTS", "MATURE", "PAYROUND", "MATURE1", "INST", "BLOCKED",
              "INSTLINES", "LINENUM"];
            const floatFields = ["PERCNT", "MU21", "MU31", "MU41", "WEIGHT", "PRICEW", "PRICER", 
              "DIM1", "DIM2", "DIM3", "SALQTY", "PURQTY", "ITEQTY", "GWEIGHT", "INTERESTDEB", "INTERESTCRE",
              "QTY", "PRICE"];
            
            if (intFields.includes(erpFieldName)) {
              objectData[erpFieldName] = typeof value === "number" ? value : parseInt(String(value), 10);
            } else if (floatFields.includes(erpFieldName)) {
              objectData[erpFieldName] = typeof value === "number" ? value : parseFloat(String(value));
            } else if (typeof value === "number" && !Number.isInteger(value)) {
              objectData[erpFieldName] = value;
            } else {
              objectData[erpFieldName] = String(value);
            }
          }
        });

        // Always include CODE (the 8-digit random code we generated) in the data sent to SoftOne
        if (recordData.CODE) {
          objectData.CODE = String(recordData.CODE);
        }

        // For ITEMS model, SoftOne table name is "MTRL", not "ITEMS"
        let objectName = integration.objectName || integration.tableName;
        if (modelName === "ITEMS") {
          objectName = "MTRL"; // SoftOne table name for items is MTRL
        }
        softOneData[objectName] = [objectData];

        // For new records, use empty KEY (SoftOne will create new record)
        // According to SoftOne API: "If the KEY is empty or missing a record is inserted"
        const key: string = "";

        // Create in SoftOne using VERSION 2 (empty KEY creates new record)
        // LOCATEINFO is not needed for create - it's only for retrieving fields in response
        const setDataResult = await setSoftOneData(
          objectName,
          key,
          softOneData,
          authResult.clientID,
          connection.appId,
          "2", // Use VERSION 2
          undefined // No LOCATEINFO needed for create
        );

        if (!setDataResult.success) {
          return NextResponse.json(
            { success: false, error: `Failed to create in SoftOne: ${setDataResult.error}` },
            { status: 500 }
          );
        }

        // Save the ID returned from SoftOne to our recordData
        // The "id" in the response is the TRDR for CUSTORMER, MTRL for ITEMS
        if (setDataResult.id) {
          if (modelName === "CUSTORMER") {
            recordData.TRDR = String(setDataResult.id);
          } else if (modelName === "ITEMS") {
            recordData.MTRL = String(setDataResult.id);
          }
        }

        // If SoftOne also returned data via LOCATEINFO, use it to update fields
        if (setDataResult.data) {
          const softOneResponse = setDataResult.data;
          // For ITEMS, check both "MTRL" and objectName (in case it's stored differently)
          const responseKey = modelName === "ITEMS" ? "MTRL" : objectName;
          if (softOneResponse[responseKey] && softOneResponse[responseKey][0]) {
            const softOneRecord = softOneResponse[responseKey][0];
            
            if (modelName === "CUSTORMER") {
              // TRDR from data takes precedence if available
              if (softOneRecord.TRDR) {
                recordData.TRDR = String(softOneRecord.TRDR);
              }
              // Also update CODE if returned
              if (softOneRecord.CODE) {
                recordData.CODE = String(softOneRecord.CODE);
              }
            } else if (modelName === "ITEMS") {
              // MTRL from data takes precedence if available
              if (softOneRecord.MTRL) {
                recordData.MTRL = String(softOneRecord.MTRL);
              }
              // Also update CODE if returned
              if (softOneRecord.CODE) {
                recordData.CODE = String(softOneRecord.CODE);
              }
            }
          } else if (softOneResponse[objectName] && softOneResponse[objectName][0]) {
            // Fallback to objectName if responseKey didn't work
            const softOneRecord = softOneResponse[objectName][0];
            
            if (modelName === "CUSTORMER") {
              if (softOneRecord.TRDR) {
                recordData.TRDR = String(softOneRecord.TRDR);
              }
              if (softOneRecord.CODE) {
                recordData.CODE = String(softOneRecord.CODE);
              }
            } else if (modelName === "ITEMS") {
              if (softOneRecord.MTRL) {
                recordData.MTRL = String(softOneRecord.MTRL);
              }
              if (softOneRecord.CODE) {
                recordData.CODE = String(softOneRecord.CODE);
              }
            }
          }
        }
      } catch (error) {
        console.error("[API] Error creating in SoftOne:", error);
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create in SoftOne",
          },
          { status: 500 }
        );
      }
    }

    // Save to our database (after SoftOne creation for two-way sync)
    const newRecord = await model.create({
      data: recordData,
    });

    return NextResponse.json({
      success: true,
      record: newRecord,
    });
  } catch (error) {
    console.error("[API] Error creating record:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create record",
      },
      { status: 500 }
    );
  }
}



