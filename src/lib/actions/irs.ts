"use server";

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

export interface IRSData {
  IRSDATA?: string; // doy_descr
  ADDRESS?: string; // postal_address + postal_address_no
  ZIP?: string; // postal_zip_code
  CITY?: string; // postal_area_description
  NAME?: string; // onomasia
  JOBTYPE?: string; // firm_act_tab.item[].firm_act_descr (comma-separated)
}

export async function fetchIRSData(afm: string): Promise<{ success: boolean; data?: IRSData; error?: string }> {
  if (!afm || afm.trim().length === 0) {
    return { success: false, error: "AFM is required" };
  }

  try {
    const response = await fetch("https://vat.wwa.gr/afm2info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ afm: afm.trim() }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `IRS service returned status ${response.status}`,
      };
    }

    const data: IRSResponse = await response.json();

    if (!data.basic_rec) {
      return {
        success: false,
        error: "No data found for this AFM",
      };
    }

    const basicRec = data.basic_rec;

    // Helper function to safely extract string value
    const getStringValue = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
      if (typeof value === "object") {
        // If it's an object, check if it has a $ property (like stop_date in the example)
        if (value.$ && typeof value.$ === "object") return null;
        // Otherwise, try to stringify or return null
        return null;
      }
      return null;
    };

    // Map the response to our form fields
    const mappedData: IRSData = {};

    // Map doy_descr to IRSDATA - use [object] only if truly missing
    const doyDescr = getStringValue(basicRec.doy_descr);
    mappedData.IRSDATA = doyDescr || "[object]";

    // Map postal_address + postal_address_no to ADDRESS - use [object] only if truly missing
    const addressParts: string[] = [];
    const postalAddress = getStringValue(basicRec.postal_address);
    const postalAddressNo = getStringValue(basicRec.postal_address_no);
    
    if (postalAddress) {
      addressParts.push(postalAddress);
    }
    if (postalAddressNo) {
      addressParts.push(postalAddressNo);
    }
    mappedData.ADDRESS = addressParts.length > 0 
      ? addressParts.join(" ") 
      : "[object]";

    // Map postal_zip_code to ZIP - use [object] only if truly missing
    const postalZipCode = getStringValue(basicRec.postal_zip_code);
    mappedData.ZIP = postalZipCode || "[object]";

    // Map postal_area_description to CITY - use [object] only if truly missing
    const postalAreaDescription = getStringValue(basicRec.postal_area_description);
    mappedData.CITY = postalAreaDescription || "[object]";

    // Map onomasia to NAME - use [object] only if truly missing
    const onomasia = getStringValue(basicRec.onomasia);
    mappedData.NAME = onomasia || "[object]";

    // Map firm_act_tab.item[].firm_act_descr to JOBTYPE - use [object] only if truly missing
    if (data.firm_act_tab?.item && Array.isArray(data.firm_act_tab.item)) {
      const jobTypes = data.firm_act_tab.item
        .map((item) => getStringValue(item.firm_act_descr))
        .filter((descr): descr is string => descr !== null);
      
      mappedData.JOBTYPE = jobTypes.length > 0 
        ? jobTypes.join(", ") 
        : "[object]";
    } else {
      mappedData.JOBTYPE = "[object]";
    }

    return {
      success: true,
      data: mappedData,
    };
  } catch (error) {
    console.error("IRS API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch IRS data",
    };
  }
}

