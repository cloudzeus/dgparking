import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface IRSResponse {
  basic_rec?: {
    afm?: string;
    doy_descr?: string;
    postal_address?: string;
    postal_address_no?: string;
    postal_zip_code?: string;
    postal_area_description?: string;
    onomasia?: string;
  };
  firm_act_tab?: {
    item?: Array<{
      firm_act_code?: string;
      firm_act_descr?: string;
      firm_act_kind?: string;
      firm_act_kind_descr?: string;
    }>;
  };
}

export interface AFMLookupData {
  IRSDATA?: string; // doy_descr
  ADDRESS?: string; // postal_address + postal_address_no
  ZIP?: string; // postal_zip_code
  CITY?: string; // postal_area_description
  NAME?: string; // onomasia
}

/**
 * POST /api/afm/lookup
 * Lookup AFM data from external service (server-side)
 */
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
    const { afm } = body;

    if (!afm || typeof afm !== "string") {
      return NextResponse.json(
        { success: false, error: "AFM is required" },
        { status: 400 }
      );
    }

    const afmToUse = afm.trim() || "99999999";

    // Call external AFM API
    const response = await fetch("https://vat.wwa.gr/afm2info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ afm: afmToUse }),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `AFM service returned status ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data: IRSResponse = await response.json();

    if (!data.basic_rec) {
      return NextResponse.json(
        { success: false, error: "No data found for this AFM" },
        { status: 404 }
      );
    }

    const basicRec = data.basic_rec;

    // Helper function to safely extract string value
    const getStringValue = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
      if (typeof value === "object") {
        if (value.$ && typeof value.$ === "object") return null;
        return null;
      }
      return null;
    };

    // Map the response to our form fields
    const mappedData: AFMLookupData = {};

    // Map onomasia to NAME
    const onomasia = getStringValue(basicRec.onomasia);
    if (onomasia) {
      mappedData.NAME = onomasia;
    }

    // Map postal_address + postal_address_no to ADDRESS
    const addressParts: string[] = [];
    const postalAddress = getStringValue(basicRec.postal_address);
    const postalAddressNo = getStringValue(basicRec.postal_address_no);
    
    if (postalAddress) {
      addressParts.push(postalAddress);
    }
    if (postalAddressNo) {
      addressParts.push(postalAddressNo);
    }
    if (addressParts.length > 0) {
      mappedData.ADDRESS = addressParts.join(" ");
    }

    // Map postal_zip_code to ZIP
    const postalZipCode = getStringValue(basicRec.postal_zip_code);
    if (postalZipCode) {
      mappedData.ZIP = postalZipCode;
    }

    // Map postal_area_description to CITY
    const postalAreaDescription = getStringValue(basicRec.postal_area_description);
    if (postalAreaDescription) {
      mappedData.CITY = postalAreaDescription;
    }

    // Map doy_descr to IRSDATA (we'll match it on the client side with our IRSDATA list)
    const doyDescr = getStringValue(basicRec.doy_descr);
    if (doyDescr) {
      mappedData.IRSDATA = doyDescr;
    }

    return NextResponse.json({
      success: true,
      data: mappedData,
    });
  } catch (error) {
    console.error("[API] AFM lookup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch AFM data",
      },
      { status: 500 }
    );
  }
}



