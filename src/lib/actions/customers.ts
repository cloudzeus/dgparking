"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// Validation schema for customer
const customerSchema = z.object({
  SODTYPE: z.number().int().default(13), // Always 13 for customers
  TRDR: z.string().optional(),
  CODE: z.string().optional(),
  NAME: z.string().min(1, "Name is required"),
  AFM: z.string().optional(),
  COUNTRY: z.string().optional(),
  ADDRESS: z.string().optional(),
  ZIP: z.string().optional(),
  CITY: z.string().optional(),
  PHONE01: z.string().optional(),
  PHONE02: z.string().optional(),
  JOBTYPE: z.string().optional(),
  WEBPAGE: z.string().url().optional().or(z.literal("")),
  EMAIL: z.string().email().optional().or(z.literal("")),
  EMAILACC: z.string().email().optional().or(z.literal("")),
  IRSDATA: z.string().optional(),
  INSDATE: z.string().optional(),
  UPDDATE: z.string().optional(),
});

export type CustomerFormState = {
  error?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
};

// Helper to parse date string
function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// Create customer action
export async function createCustomer(
  prevState: CustomerFormState | undefined,
  formData: FormData
): Promise<CustomerFormState> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      SODTYPE: 13, // Always 13 for customers
      TRDR: formData.get("TRDR")?.toString() || undefined,
      CODE: formData.get("CODE")?.toString() || undefined,
      NAME: formData.get("NAME")?.toString() || "",
      AFM: formData.get("AFM")?.toString() || undefined,
      COUNTRY: formData.get("COUNTRY")?.toString() || undefined,
      ADDRESS: formData.get("ADDRESS")?.toString() || undefined,
      ZIP: formData.get("ZIP")?.toString() || undefined,
      CITY: formData.get("CITY")?.toString() || undefined,
      PHONE01: formData.get("PHONE01")?.toString() || undefined,
      PHONE02: formData.get("PHONE02")?.toString() || undefined,
      JOBTYPE: formData.get("JOBTYPE")?.toString() || undefined,
      WEBPAGE: formData.get("WEBPAGE")?.toString() || undefined,
      EMAIL: formData.get("EMAIL")?.toString() || undefined,
      EMAILACC: formData.get("EMAILACC")?.toString() || undefined,
      IRSDATA: formData.get("IRSDATA")?.toString() || undefined,
      INSDATE: formData.get("INSDATE")?.toString() || undefined,
      UPDDATE: formData.get("UPDDATE")?.toString() || undefined,
    };

    const validatedData = customerSchema.parse(rawData);

    const customer = await prisma.cUSTORMER.create({
      data: {
        SODTYPE: validatedData.SODTYPE,
        TRDR: validatedData.TRDR,
        CODE: validatedData.CODE,
        NAME: validatedData.NAME,
        AFM: validatedData.AFM,
        COUNTRY: validatedData.COUNTRY,
        ADDRESS: validatedData.ADDRESS,
        ZIP: validatedData.ZIP,
        CITY: validatedData.CITY,
        PHONE01: validatedData.PHONE01,
        PHONE02: validatedData.PHONE02,
        JOBTYPE: validatedData.JOBTYPE,
        WEBPAGE: validatedData.WEBPAGE || undefined,
        EMAIL: validatedData.EMAIL || undefined,
        EMAILACC: validatedData.EMAILACC || undefined,
        IRSDATA: validatedData.IRSDATA,
        INSDATE: parseDate(validatedData.INSDATE),
        UPDDATE: parseDate(validatedData.UPDDATE),
      },
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        errors: error.flatten().fieldErrors,
        error: "Validation failed",
      };
    }
    console.error("Create customer error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create customer",
    };
  }
}

// Update customer action
export async function updateCustomer(
  customerId: number,
  prevState: CustomerFormState | undefined,
  formData: FormData
): Promise<CustomerFormState> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  try {
    const rawData = {
      SODTYPE: 13, // Always 13 for customers
      TRDR: formData.get("TRDR")?.toString() || undefined,
      CODE: formData.get("CODE")?.toString() || undefined,
      NAME: formData.get("NAME")?.toString() || "",
      AFM: formData.get("AFM")?.toString() || undefined,
      COUNTRY: formData.get("COUNTRY")?.toString() || undefined,
      ADDRESS: formData.get("ADDRESS")?.toString() || undefined,
      ZIP: formData.get("ZIP")?.toString() || undefined,
      CITY: formData.get("CITY")?.toString() || undefined,
      PHONE01: formData.get("PHONE01")?.toString() || undefined,
      PHONE02: formData.get("PHONE02")?.toString() || undefined,
      JOBTYPE: formData.get("JOBTYPE")?.toString() || undefined,
      WEBPAGE: formData.get("WEBPAGE")?.toString() || undefined,
      EMAIL: formData.get("EMAIL")?.toString() || undefined,
      EMAILACC: formData.get("EMAILACC")?.toString() || undefined,
      IRSDATA: formData.get("IRSDATA")?.toString() || undefined,
      INSDATE: formData.get("INSDATE")?.toString() || undefined,
      UPDDATE: formData.get("UPDDATE")?.toString() || undefined,
    };

    const validatedData = customerSchema.parse(rawData);

    await prisma.cUSTORMER.update({
      where: { id: customerId },
      data: {
        SODTYPE: validatedData.SODTYPE,
        TRDR: validatedData.TRDR,
        CODE: validatedData.CODE,
        NAME: validatedData.NAME,
        AFM: validatedData.AFM,
        COUNTRY: validatedData.COUNTRY,
        ADDRESS: validatedData.ADDRESS,
        ZIP: validatedData.ZIP,
        CITY: validatedData.CITY,
        PHONE01: validatedData.PHONE01,
        PHONE02: validatedData.PHONE02,
        JOBTYPE: validatedData.JOBTYPE,
        WEBPAGE: validatedData.WEBPAGE || undefined,
        EMAIL: validatedData.EMAIL || undefined,
        EMAILACC: validatedData.EMAILACC || undefined,
        IRSDATA: validatedData.IRSDATA,
        INSDATE: parseDate(validatedData.INSDATE),
        UPDDATE: parseDate(validatedData.UPDDATE),
      },
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        errors: error.flatten().fieldErrors,
        error: "Validation failed",
      };
    }
    console.error("Update customer error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update customer",
    };
  }
}

// Delete customer action
export async function deleteCustomer(customerId: number): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  try {
    await prisma.cUSTORMER.delete({
      where: { id: customerId },
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    console.error("Delete customer error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete customer",
    };
  }
}

// Sync customers from SoftOne ERP
export async function syncCustomersFromERP(): Promise<{
  success?: boolean;
  error?: string;
  synced?: number;
  skipped?: number;
  total?: number;
}> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  try {
    const { softOneAPIRequest, getSoftOneClientId } = await import("@/lib/softone-api");

    const clientId = await getSoftOneClientId();
    if (!clientId) {
      return { error: "Not authenticated with SoftOne ERP. Please authenticate first." };
    }

    const appId = process.env.SOFTONE_appId || "1001";
    const version = process.env.SOFTONE_version || "1";

    console.log("SoftOne API - Sync Customers Request:", {
      service: "GetTable",
      clientID: clientId.substring(0, 20) + "...",
      appId,
      version,
    });

    // Use softOneAPIRequest helper which handles encoding and clientID automatically
    const requestPayload = {
      appId: Number(appId),
      version: version,
      TABLE: "CUSTOMER",
      FIELDS: "TRDR,CODE,NAME,AFM,ADDRESS,ZIP,CITY,PHONE01,PHONE02,WEBPAGE,EMAIL,EMAILACC,IRSDATA,INSDATE,UPDDATE",
      FILTER: "1=1",
    };

    console.log("=== SoftOne API - Sync Customers Request ===");
    console.log("ClientID:", clientId);
    console.log("Request Payload (before adding clientID):", JSON.stringify(requestPayload, null, 2));
    console.log("Note: clientID will be added automatically by softOneAPIRequest");

    const responseData = await softOneAPIRequest("GetTable", requestPayload);

    console.log("=== SoftOne API - Full Response ===");
    console.log(JSON.stringify(responseData, null, 2));

    console.log("=== SoftOne API - Response Summary ===");
    console.log("Success:", responseData.success);
    console.log("Table:", responseData.table);
    console.log("Count:", responseData.count);
    console.log("Keys:", responseData.keys);
    console.log("Data Length:", responseData.data?.length);
    console.log("Has Model:", !!responseData.model);
    console.log("Model Length:", responseData.model?.length);
    console.log("All Response Keys:", Object.keys(responseData));

    // Log model structure
    if (responseData.model && Array.isArray(responseData.model) && responseData.model.length > 0) {
      console.log("=== SoftOne API - Model Structure ===");
      console.log(JSON.stringify(responseData.model, null, 2));
      if (responseData.model[0] && Array.isArray(responseData.model[0])) {
        console.log("Model Field Definitions:");
        responseData.model[0].forEach((field: any, index: number) => {
          console.log(`  [${index}] ${field.name} (${field.type})`);
        });
      }
    }

    // Log sample data rows
    if (responseData.data && Array.isArray(responseData.data)) {
      console.log("=== SoftOne API - Sample Data Rows ===");
      console.log(`Total Rows: ${responseData.data.length}`);
      
      // Log first 3 rows
      const sampleRows = responseData.data.slice(0, 3);
      sampleRows.forEach((row: any, index: number) => {
        console.log(`Row ${index + 1}:`, JSON.stringify(row, null, 2));
      });

      // Log a middle row if there are many
      if (responseData.data.length > 10) {
        const middleIndex = Math.floor(responseData.data.length / 2);
        console.log(`Row ${middleIndex + 1} (middle):`, JSON.stringify(responseData.data[middleIndex], null, 2));
      }

      // Log last row
      if (responseData.data.length > 0) {
        console.log(`Row ${responseData.data.length} (last):`, JSON.stringify(responseData.data[responseData.data.length - 1], null, 2));
      }
    }

    // Check if response is successful
    if (!responseData.success) {
      console.error("SoftOne API - Response indicates failure:", responseData);
      return {
        error: responseData.error || "Failed to fetch customers from ERP",
      };
    }

    // Check if data exists and is an array
    if (!responseData.data || !Array.isArray(responseData.data)) {
      console.error("SoftOne API - Invalid data structure:", {
        hasData: !!responseData.data,
        dataType: typeof responseData.data,
        dataIsArray: Array.isArray(responseData.data),
        responseKeys: Object.keys(responseData),
      });
      return {
        error: "Invalid response structure from SoftOne API",
      };
    }

    // Check if model exists to map fields
    if (!responseData.model || !Array.isArray(responseData.model) || responseData.model.length === 0) {
      console.error("SoftOne API - Missing model definition:", responseData.model);
      return {
        error: "Missing model definition in response",
      };
    }

    const customersData = responseData.data;
    const totalCustomers = customersData.length;
    let synced = 0;
    let skipped = 0;
    let processed = 0;

    console.log("=== Starting Customer Processing ===");
    console.log(`Total customers to process: ${totalCustomers}`);

    // Process each customer
    for (const customerRow of customersData) {
      processed++;
      
      // Log progress every 100 customers
      if (processed % 100 === 0 || processed === 1) {
        console.log(`Processing customer ${processed}/${totalCustomers} (Synced: ${synced}, Skipped: ${skipped})`);
      }
      // customerRow is an array: [TRDR, CODE, NAME, AFM, ADDRESS, ZIP, CITY, PHONE01, PHONE02, WEBPAGE, EMAIL, EMAILACC, IRSDATA, INSDATE, UPDDATE]
      const [
        trdr,
        code,
        name,
        afm,
        address,
        zip,
        city,
        phone01,
        phone02,
        webpage,
        email,
        emailacc,
        irsdata,
        insdate,
        upddate,
      ] = customerRow;

      // Skip if CODE is missing (required for uniqueness check)
      if (!code || code.toString().trim().length === 0) {
        if (processed <= 5) {
          console.log(`  [${processed}] Skipping - Missing CODE:`, customerRow);
        }
        skipped++;
        continue;
      }

      const codeValue = code.toString().trim();

      // Check if customer already exists by CODE
      const existingCustomer = await prisma.cUSTORMER.findFirst({
        where: { CODE: codeValue },
      });

      if (existingCustomer) {
        if (processed <= 5) {
          console.log(`  [${processed}] Skipping - Already exists: CODE=${codeValue}`);
        }
        skipped++;
        continue;
      }

      // Parse dates
      const parseDate = (dateStr: any): Date | null => {
        if (!dateStr || dateStr === "") return null;
        try {
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      };

      // Prepare customer data
      const customerData = {
        SODTYPE: 13, // Always 13 for customers
        TRDR: trdr ? trdr.toString().trim() : null,
        CODE: codeValue,
        NAME: name ? name.toString().trim() : null,
        AFM: afm ? afm.toString().trim() : null,
        ADDRESS: address ? address.toString().trim() : null,
        ZIP: zip ? zip.toString().trim() : null,
        CITY: city ? city.toString().trim() : null,
        PHONE01: phone01 ? phone01.toString().trim() : null,
        PHONE02: phone02 ? phone02.toString().trim() : null,
        WEBPAGE: webpage ? webpage.toString().trim() : null,
        EMAIL: email ? email.toString().trim() : null,
        EMAILACC: emailacc ? emailacc.toString().trim() : null,
        IRSDATA: irsdata ? irsdata.toString().trim() : null,
        INSDATE: parseDate(insdate),
        UPDDATE: parseDate(upddate),
      };

      // Log first few insertions for debugging
      if (synced < 3) {
        console.log(`  [${processed}] Inserting new customer:`, {
          CODE: customerData.CODE,
          NAME: customerData.NAME,
          AFM: customerData.AFM,
        });
      }

      // Insert new customer
      try {
        await prisma.cUSTORMER.create({
          data: customerData,
        });
        synced++;
      } catch (dbError) {
        console.error(`  [${processed}] Failed to insert customer CODE=${codeValue}:`, dbError);
        console.error("  Customer data:", customerData);
        skipped++;
      }
    }

    console.log("=== Customer Processing Complete ===");
    console.log(`Total Processed: ${processed}`);
    console.log(`Synced: ${synced}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total from API: ${totalCustomers}`);

    revalidatePath("/customers");

    return {
      success: true,
      synced,
      skipped,
      total: totalCustomers,
    };
  } catch (error) {
    console.error("Sync customers error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to sync customers from ERP",
    };
  }
}

