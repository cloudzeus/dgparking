/**
 * SoftOne API Client - SERVER-SIDE ONLY
 * 
 * IMPORTANT: All functions in this file are SERVER-SIDE ONLY.
 * They use Next.js server-only APIs (cookies from next/headers, Buffer, etc.)
 * 
 * Client components should NEVER import this file directly.
 * Instead, use the API routes in /app/api/softone/* which call these functions server-side.
 * 
 * Example:
 * - Client component calls: fetch("/api/softone/login-authenticate", ...)
 * - API route calls: authenticateSoftOneAPI(...) [server-side]
 * - authenticateSoftOneAPI makes fetch to SoftOne API [server-side]
 */

import iconv from "iconv-lite";
import { cookies } from "next/headers";

const SOFTONE_API_URL = process.env.SOFTONE_apiUrl || "https://kolleris.oncloud.gr/s1services";
const CLIENT_ID_COOKIE_NAME = "softone_client_id";

/**
 * Convert ANSI 1253 (Windows-1253) encoded response to UTF-8 using iconv-lite and ArrayBuffer
 * 
 * SoftOne API returns responses encoded in ANSI 1253 (Greek Windows encoding).
 * This helper function properly converts the response to UTF-8 for JSON parsing.
 * 
 * @param response - The fetch Response object
 * @returns Promise<string> - The decoded UTF-8 string
 */
async function convertAnsi1253ToUtf8(response: Response): Promise<string> {
  // Get the response as ArrayBuffer
  const arrayBuffer = await response.arrayBuffer();
  
  // Convert ArrayBuffer to Node.js Buffer
  const buffer = Buffer.from(arrayBuffer);
  
  // Decode from ANSI 1253 (Windows-1253) to UTF-8 using iconv-lite
  const utf8String = iconv.decode(buffer, "win1253");
  
  return utf8String;
}

/**
 * Get SoftOne clientID from session (cookies)
 */
export async function getSoftOneClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CLIENT_ID_COOKIE_NAME)?.value || null;
}

/**
 * Store SoftOne clientID in session (cookies)
 */
export async function setSoftOneClientId(clientId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_ID_COOKIE_NAME, clientId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Clear SoftOne clientID from session
 */
export async function clearSoftOneClientId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_ID_COOKIE_NAME);
}

/**
 * Authenticate with SoftOne ERP API (SERVER-SIDE ONLY)
 * 
 * Makes a POST request to SoftOne API matching the axios example pattern:
 * - Method: POST
 * - URL: https://kolleris.oncloud.gr/s1services
 * - Headers: Content-Type: application/json
 * - Body: JSON stringified request data
 * 
 * Returns the clientID and stores it in session (cookies)
 * 
 * @example
 * ```typescript
 * // Server-side only (API route, server action, etc.)
 * const result = await authenticateSoftOneAPI(
 *   "username",
 *   "password",
 *   "1001",
 *   "1001", // company
 *   "1000", // branch
 *   "0",    // module
 *   "15",   // refid
 *   "1",    // version
 *   "registeredName" // optional
 * );
 * ```
 */
export async function authenticateSoftOneAPI(
  username: string,
  password: string,
  appId: string,
  company: string = process.env.SOFTONE_company || "1001",
  branch: string = process.env.SOFTONE_branch || "1000",
  module: string = process.env.SOFTONE_module || "0",
  refId: string = process.env.SOFTONE_refId || "15",
  version: string = process.env.SOFTONE_version || "1",
  registeredName?: string
) {
  // Ensure all values are strings as required by SoftOne API
  // All fields must match the exact format from SoftOne API documentation
  // This matches the axios example pattern exactly
  const requestData: Record<string, string> = {
    service: "login",
    username: String(username),
    password: String(password),
    appId: String(appId),
    COMPANY: String(company),
    BRANCH: String(branch),
    MODULE: String(module),
    REFID: String(refId),
    VERSION: String(version),
  };

  // Add registeredName if provided (optional field)
  if (registeredName) {
    requestData.registeredName = String(registeredName);
  } else if (process.env.SOFTONE_registeredName) {
    requestData.registeredName = String(process.env.SOFTONE_registeredName);
  }

  // Log request data for debugging (matches axios example pattern)
  console.log("SoftOne API - Request Data:", JSON.stringify(requestData, null, 2));
  console.log("SoftOne API - Request URL:", SOFTONE_API_URL);
  console.log("SoftOne API - Authenticating:", {
    url: SOFTONE_API_URL,
    username,
    appId,
    company,
    branch,
    module,
    refId,
    version,
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // Make POST request matching axios example pattern
    // Using fetch instead of axios, but same structure
    // Add timeout to handle slow connections (30 seconds)
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(SOFTONE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
      signal: controller.signal,
    });
    
    if (timeoutId != null) clearTimeout(timeoutId);

    // Convert ANSI 1253 to UTF-8 using iconv-lite and ArrayBuffer
    const jsonData = await convertAnsi1253ToUtf8(response);
    const data = JSON.parse(jsonData);

    console.log("SoftOne API - Authentication Response:", JSON.stringify(data, null, 2));

    if (data.success && data.clientID) {
      // Store clientID in session
      await setSoftOneClientId(data.clientID);
      return {
        success: true,
        clientID: data.clientID,
        s1u: data.s1u,
        hyperlinks: data.hyperlinks,
        canexport: data.canexport,
        image: data.image,
        companyinfo: data.companyinfo,
      };
    }

    return {
      success: false,
      error: data.error || "Authentication failed",
      data,
    };
  } catch (error) {
    if (timeoutId != null) clearTimeout(timeoutId); // Ensure timeout is cleared on error
    console.error("SoftOne API - Authentication Error:", error);
    
    // Provide more specific error message for timeout errors
    let errorMessage = "Failed to authenticate with SoftOne API";
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout") || error.message.includes("Timeout")) {
        errorMessage = "Connection timeout: SoftOne API server did not respond within 30 seconds. Please check your network connection and try again.";
      } else if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
        errorMessage = `Connection failed: Unable to reach SoftOne API server (${SOFTONE_API_URL}). Please check your network connection and server availability.`;
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Make a request to SoftOne API with stored clientID (SERVER-SIDE ONLY)
 * 
 * Uses the clientID stored in cookies from previous authentication.
 * All SoftOne API requests are made server-side only.
 */
export async function softOneAPIRequest(
  service: string,
  data: Record<string, any> = {}
) {
  const clientID = await getSoftOneClientId();

  if (!clientID) {
    throw new Error("Not authenticated with SoftOne. Please authenticate first.");
  }

  const requestData = {
    service,
    clientID,
    ...data,
  };

  console.log("=== SoftOne API - Request Details ===");
  console.log("URL:", SOFTONE_API_URL);
  console.log("Service:", service);
  console.log("ClientID:", clientID);
  console.log("Full Request Payload:", JSON.stringify(requestData, null, 2));

  try {
    const response = await fetch(SOFTONE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    // Convert ANSI 1253 to UTF-8 using iconv-lite and ArrayBuffer
    const jsonData = await convertAnsi1253ToUtf8(response);
    const result = JSON.parse(jsonData);

    console.log("SoftOne API - Response:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error("SoftOne API - Request Error:", error);
    throw error;
  }
}

/**
 * Make a request to SoftOne API with explicit clientID (SERVER-SIDE ONLY)
 * 
 * For use with stored connections where clientID is provided explicitly.
 * All SoftOne API requests are made server-side only.
 */
export async function softOneAPIRequestWithClientId(
  clientID: string,
  service: string,
  data: Record<string, any> = {}
) {
  const requestData = {
    service,
    clientID,
    ...data,
  };

  console.log("=== SoftOne API - Request Details (with explicit clientID) ===");
  console.log("URL:", SOFTONE_API_URL);
  console.log("Service:", service);
  console.log("ClientID:", clientID.substring(0, 20) + "...");
  console.log("Full Request Payload:", JSON.stringify(requestData, null, 2));

  try {
    const response = await fetch(SOFTONE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    // Convert ANSI 1253 to UTF-8 using iconv-lite and ArrayBuffer
    const jsonData = await convertAnsi1253ToUtf8(response);
    const result = JSON.parse(jsonData);

    console.log("SoftOne API - Response:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error("SoftOne API - Request Error:", error);
    throw error;
  }
}

/**
 * Get SoftOne objects (SERVER-SIDE ONLY)
 * 
 * Gets SoftOne objects (EditMaster, EditList, etc.)
 * Requires authentication (clientID) and appId
 * 
 * This function calls SoftOne API server-side only.
 * Client components should use /api/softone/objects route instead.
 * 
 * @param clientID - SoftOne clientID from authentication
 * @param appId - Application ID (required for getObjects service)
 */
export async function getSoftOneObjects(
  clientID: string,
  appId: string
): Promise<{
  success: boolean;
  objects?: Array<{
    name: string;
    caption: string;
    type: string;
  }>;
  error?: string;
  count?: number;
}> {
  try {
    if (!clientID) {
      return {
        success: false,
        error: "Not authenticated with SoftOne. Please authenticate first.",
      };
    }

    if (!appId) {
      return {
        success: false,
        error: "appId is required for getObjects service",
      };
    }

    // Call getObjects service with clientID and appId
    const result = await softOneAPIRequestWithClientId(clientID, "getObjects", {
      appId: String(appId),
    });

    if (result.success && result.objects) {
      return {
        success: true,
        objects: result.objects,
        count: result.count,
      };
    }

    return {
      success: false,
      error: result.error || "Failed to get objects",
    };
  } catch (error) {
    console.error("SoftOne API - Get Objects Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get objects",
    };
  }
}

/**
 * Get tables for a specific SoftOne object (SERVER-SIDE ONLY)
 * 
 * Requires authentication (clientID), object name, and appId.
 * This function calls SoftOne API server-side only.
 * Client components should use /api/softone/tables route instead.
 * 
 * Matches the axios example pattern:
 * - service: "getObjectTables"
 * - clientID: (from authentication)
 * - appId: (required)
 * - OBJECT: (object name, uppercase key)
 * - VERSION: "1"
 * 
 * @param objectName - The object name (e.g., "CUSTOMER")
 * @param clientID - SoftOne clientID from authentication
 * @param appId - Application ID (required)
 * @param version - Version (defaults to "1")
 */
export async function getSoftOneObjectTables(
  objectName: string,
  clientID: string,
  appId: string,
  version: string = "1"
): Promise<{
  success: boolean;
  tables?: Array<{
    name: string;
    dbname: string;
    caption: string;
  }>;
  error?: string;
}> {
  try {
    if (!clientID) {
      return {
        success: false,
        error: "Not authenticated with SoftOne. Please authenticate first.",
      };
    }

    if (!objectName) {
      return {
        success: false,
        error: "Object name is required",
      };
    }

    if (!appId) {
      return {
        success: false,
        error: "appId is required for getObjectTables service",
      };
    }

    // Call getObjectTables service with required parameters
    // Matching the axios example: OBJECT (uppercase), appId, VERSION
    const result = await softOneAPIRequestWithClientId(clientID, "getObjectTables", {
      appId: String(appId),
      OBJECT: String(objectName),
      VERSION: String(version),
    });

    if (result.success && result.tables) {
      return {
        success: true,
        tables: result.tables,
      };
    }

    return {
      success: false,
      error: result.error || "Failed to get object tables",
    };
  } catch (error) {
    console.error("SoftOne API - Get Object Tables Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get object tables",
    };
  }
}

/**
 * Get fields for a specific SoftOne table (SERVER-SIDE ONLY)
 * 
 * Requires authentication (clientID), object name, table name, and appId.
 * This function calls SoftOne API server-side only.
 * Client components should use /api/softone/table-fields route instead.
 * 
 * Matches the axios example pattern:
 * - service: "getTableFields"
 * - clientID: (from authentication)
 * - appId: (required)
 * - OBJECT: (object name, uppercase key)
 * - TABLE: (table name, uppercase key)
 * - VERSION: "1"
 * 
 * @param objectName - The object name (e.g., "CUSTOMER")
 * @param tableName - The table name (e.g., "TRDR")
 * @param clientID - SoftOne clientID from authentication
 * @param appId - Application ID (required)
 * @param version - Version (defaults to "1")
 */
export interface SoftOneTableField {
  name: string;
  alias: string;
  fullname: string;
  caption: string;
  size: string;
  type: string;
  edittype: string;
  xtype: string;
  defaultvalue: string;
  decimals: string;
  editor: string;
  readOnly: boolean;
  visible: boolean;
  required: boolean;
  calculated: boolean;
  links?: Array<{
    name: string;
    caption: string;
  }>;
}

export async function getSoftOneTableFields(
  objectName: string,
  tableName: string,
  clientID: string,
  appId: string,
  version: string = "1"
): Promise<{
  success: boolean;
  fields?: SoftOneTableField[];
  count?: number;
  error?: string;
}> {
  try {
    if (!clientID) {
      return {
        success: false,
        error: "Not authenticated with SoftOne. Please authenticate first.",
      };
    }

    if (!objectName) {
      return {
        success: false,
        error: "Object name is required",
      };
    }

    if (!tableName) {
      return {
        success: false,
        error: "Table name is required",
      };
    }

    if (!appId) {
      return {
        success: false,
        error: "appId is required for getTableFields service",
      };
    }

    // Call getTableFields service with required parameters
    // Matching the axios example: OBJECT, TABLE (uppercase), appId, VERSION
    const result = await softOneAPIRequestWithClientId(clientID, "getTableFields", {
      appId: String(appId),
      OBJECT: String(objectName),
      TABLE: String(tableName),
      VERSION: String(version),
    });

    if (result.success && result.fields) {
      return {
        success: true,
        fields: result.fields,
        count: result.count,
      };
    }

    return {
      success: false,
      error: result.error || "Failed to get table fields",
    };
  } catch (error) {
    console.error("SoftOne API - Get Table Fields Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get table fields",
    };
  }
}

/**
 * Get table data from SoftOne (SERVER-SIDE ONLY)
 * 
 * Retrieves actual data from a SoftOne table using selected fields and filter.
 * This function calls SoftOne API server-side only.
 * Client components should use /api/softone/get-table route instead.
 * 
 * Matches the axios example pattern:
 * - service: "GetTable"
 * - clientId: (from authentication)
 * - appId: (required, as number)
 * - version: "1"
 * - TABLE: (table name, uppercase key)
 * - FIELDS: (comma-separated field names)
 * - FILTER: (filter condition, e.g., "1=1" for all records)
 * 
 * @param tableName - The table name (e.g., "mtrl")
 * @param fields - Comma-separated field names (e.g., "CODE,NAME,CODE1")
 * @param filter - Filter condition (defaults to "1=1" for all records)
 * @param clientID - SoftOne clientID from authentication
 * @param appId - Application ID (required, as number)
 * @param version - Version (defaults to "1")
 */
export async function getSoftOneTableData(
  tableName: string,
  fields: string,
  clientID: string,
  appId: string | number,
  filter: string = "1=1",
  version: string = "1",
  filters?: string // Optional FILTERS parameter (for ITEMS model with INSDATE/UPDDATE)
): Promise<{
  success: boolean;
  data?: any[];
  count?: number;
  table?: string;
  keys?: string[];
  error?: string;
}> {
  try {
    if (!clientID) {
      return {
        success: false,
        error: "Not authenticated with SoftOne. Please authenticate first.",
      };
    }

    if (!tableName) {
      return {
        success: false,
        error: "Table name is required",
      };
    }

    if (!fields) {
      return {
        success: false,
        error: "Fields are required",
      };
    }

    if (!appId) {
      return {
        success: false,
        error: "appId is required for GetTable service",
      };
    }

    // Call GetTable service with required parameters
    // Matching the working Postman example exactly:
    // - clientId (camelCase, not clientID)
    // - appId as number (not string)
    // - version as string "1"
    // - service as "GetTable"
    // - TABLE, FIELDS, FILTER (uppercase keys)
    // - FILTERS (optional, for ITEMS model with INSDATE/UPDDATE)
    const requestData: any = {
      service: "GetTable",
      clientId: String(clientID), // camelCase clientId (matching Postman example)
      appId: typeof appId === "string" ? Number(appId) : appId, // Number, not string
      version: String(version),
      TABLE: String(tableName),
      FIELDS: String(fields),
      FILTER: String(filter),
    };

    // Add FILTERS parameter if provided (for ITEMS model)
    if (filters) {
      requestData.FILTERS = String(filters);
    }

    // Minimal logging for GetTable
    console.log(`[GetTable] ${requestData.TABLE} | FILTER: ${requestData.FILTER}`);

    try {
      const response = await fetch(SOFTONE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // Check response status
      if (!response.ok) {
        console.error("SoftOne API - GetTable HTTP Error:", response.status, response.statusText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Convert ANSI 1253 to UTF-8 using iconv-lite and ArrayBuffer
      const jsonData = await convertAnsi1253ToUtf8(response);
      const result = JSON.parse(jsonData);

      // Minimal logging - only log errors
      if (!result.success) {
        console.error(`[GetTable] Error: ${result.error || 'Unknown error'}`);
      }

      // Check if result has success property
      if (result.success === false) {
        return {
          success: false,
          error: result.error || "Failed to get table data",
        };
      }

      if (result.success && result.data) {
        return {
          success: true,
          data: result.data,
          count: result.count,
          table: result.table,
          keys: result.keys,
        };
      }

      // If no success property, check if we have data anyway
      if (result.data) {
        return {
          success: true,
          data: result.data,
          count: result.count,
          table: result.table,
          keys: result.keys,
        };
      }

      return {
        success: false,
        error: result.error || "Failed to get table data",
      };
    } catch (fetchError) {
      console.error("SoftOne API - GetTable Fetch Error:", fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error("SoftOne API - Get Table Data Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get table data",
    };
  }
}

/**
 * Get table data from SoftOne using SqlData service (SERVER-SIDE ONLY)
 * 
 * Uses pre-defined SQL scripts in SoftOne for efficient incremental sync.
 * This service is optimized for INST, INSTLINES, TRDR, and MTRL tables.
 * 
 * @param sqlName - SQL script ID as string (e.g., "135", "136", "137", "138") or script name (string)
 * @param param1 - Cutoff datetime in format "yyyy-mm-dd HH:MM:SS"
 * @param clientID - SoftOne clientID from authentication
 * @param appId - Application ID (required, as number)
 * 
 * @returns Promise with success, totalcount, and rows array
 * 
 * @example
 * ```typescript
 * const result = await getSoftOneSqlData(
 *   135, // SQL script ID for INST_ChangedSince
 *   "2025-01-01 00:00:00",
 *   clientID,
 *   3001
 * );
 * ```
 */
export async function getSoftOneSqlData(
  sqlName: string | number,
  param1: string,
  clientID: string,
  appId: string | number
): Promise<{
  success: boolean;
  totalcount?: number;
  rows?: any[];
  error?: string;
}> {
  try {
    if (!clientID) {
      return {
        success: false,
        error: "Not authenticated with SoftOne. Please authenticate first.",
      };
    }

    if (sqlName === undefined || sqlName === null || sqlName === '') {
      return {
        success: false,
        error: "SQL script ID or name (sqlName) is required",
      };
    }

    if (!param1) {
      return {
        success: false,
        error: "PARAM1 (cutoff datetime) is required",
      };
    }

    if (!appId) {
      return {
        success: false,
        error: "appId is required for SqlData service",
      };
    }

    // Call SqlData service
    // Using exact parameter names from SoftOne documentation
    const requestData: any = {
      service: "SqlData",
      clientID: String(clientID),
      appId: String(appId), // String, not number (matching working example)
      SqlName: String(sqlName), // camelCase SqlName, not SQLNAME
      param1: String(param1), // lowercase param1, not PARAM1
    };

    // Minimal logging for SqlData
    console.log(`[SqlData] ${requestData.SqlName} | param1: ${requestData.param1}`);

    try {
      const response = await fetch(SOFTONE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // Check response status
      if (!response.ok) {
        console.error("SoftOne API - SqlData HTTP Error:", response.status, response.statusText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Convert ANSI 1253 to UTF-8 using iconv-lite and ArrayBuffer
      const jsonData = await convertAnsi1253ToUtf8(response);
      const result = JSON.parse(jsonData);

      // Minimal logging - only log errors
      if (!result.success) {
        console.error(`[SqlData] Error: ${result.error || 'Unknown error'}`);
      }

      // Check if result has success property
      if (result.success === false) {
        // Check for various error fields in the response
        const errorMessage = result.error || 
                           result.errormessage || 
                           result.errorMessage ||
                           result.message ||
                           result.errorcode ||
                           (result.errorcode !== undefined ? `Error code: ${result.errorcode}` : null) ||
                           "Failed to get data from SqlData";
        
        console.error("SoftOne API - SqlData Error:", errorMessage);
        console.error("SoftOne API - SqlData Full Error Response:", JSON.stringify(result, null, 2));
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      if (result.success && result.rows) {
        return {
          success: true,
          totalcount: result.totalcount,
          rows: result.rows,
        };
      }

      // If success is true but no rows, that's still valid (empty result set)
      if (result.success === true) {
        return {
          success: true,
          totalcount: result.totalcount || 0,
          rows: result.rows || [],
        };
      }

      // Unknown response format
      console.error("SoftOne API - SqlData Unknown Response Format:", JSON.stringify(result, null, 2));
      return {
        success: false,
        error: result.error || result.errormessage || result.message || "Unknown error from SqlData service",
      };
    } catch (fetchError) {
      console.error("SoftOne API - SqlData Fetch Error:", fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error("SoftOne API - SqlData Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get data from SqlData",
    };
  }
}

/**
 * Get specific fields from a table using selectorFields service (SERVER-SIDE ONLY)
 * 
 * Returns data of specific fields from a table based on a key value.
 * 
 * @param tableName - Table name (e.g., "CUSTOMER")
 * @param keyName - Key field name (e.g., "TRDR")
 * @param keyValue - Key field value (e.g., 47)
 * @param resultFields - Comma-separated list of fields to return (e.g., "CODE,NAME,AFM")
 * @param clientID - SoftOne clientID from authentication
 * @param appId - Application ID (required, as number)
 * 
 * @returns Promise with success, totalcount, and rows array
 * 
 * @example
 * ```typescript
 * const result = await getSoftOneSelectorFields(
 *   "CUSTOMER",
 *   "TRDR",
 *   47,
 *   "CODE,NAME,AFM",
 *   clientID,
 *   2001
 * );
 * ```
 */
export async function getSoftOneSelectorFields(
  tableName: string,
  keyName: string,
  keyValue: string | number,
  resultFields: string,
  clientID: string,
  appId: string | number
): Promise<{
  success: boolean;
  totalcount?: number;
  rows?: any[];
  error?: string;
}> {
  try {
    if (!clientID) {
      return {
        success: false,
        error: "Not authenticated with SoftOne. Please authenticate first.",
      };
    }

    if (!tableName) {
      return {
        success: false,
        error: "Table name (tableName) is required",
      };
    }

    if (!keyName) {
      return {
        success: false,
        error: "Key name (keyName) is required",
      };
    }

    if (keyValue === undefined || keyValue === null) {
      return {
        success: false,
        error: "Key value (keyValue) is required",
      };
    }

    if (!resultFields) {
      return {
        success: false,
        error: "Result fields (resultFields) is required",
      };
    }

    if (!appId) {
      return {
        success: false,
        error: "appId is required for selectorFields service",
      };
    }

    // Call selectorFields service
    const requestData: any = {
      service: "selectorFields",
      clientID: String(clientID),
      appId: typeof appId === "string" ? Number(appId) : appId,
      TABLENAME: String(tableName),
      KEYNAME: String(keyName),
      KEYVALUE: typeof keyValue === "string" ? keyValue : Number(keyValue),
      RESULTFIELDS: String(resultFields),
    };

    console.log("=== SoftOne API - selectorFields Request ===");
    console.log("URL:", SOFTONE_API_URL);
    console.log("Full Request Payload:", JSON.stringify(requestData, null, 2));

    try {
      const response = await fetch(SOFTONE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // Check response status
      if (!response.ok) {
        console.error("SoftOne API - selectorFields HTTP Error:", response.status, response.statusText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Convert ANSI 1253 to UTF-8 using iconv-lite and ArrayBuffer
      const jsonData = await convertAnsi1253ToUtf8(response);
      const result = JSON.parse(jsonData);

      console.log("SoftOne API - selectorFields Response:", JSON.stringify({
        success: result.success,
        totalcount: result.totalcount,
        rowsCount: result.rows?.length || 0,
        error: result.error
      }, null, 2));

      // Check if result has success property
      if (result.success === false) {
        return {
          success: false,
          error: result.error || "Failed to get data from selectorFields",
        };
      }

      if (result.success && result.rows) {
        return {
          success: true,
          totalcount: result.totalcount,
          rows: result.rows,
        };
      }

      return {
        success: false,
        error: result.error || "Failed to get data from selectorFields",
      };
    } catch (fetchError) {
      console.error("SoftOne API - selectorFields Fetch Error:", fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error("SoftOne API - selectorFields Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get data from selectorFields",
    };
  }
}

/**
 * Set data in SoftOne ERP using setData service (SERVER-SIDE ONLY)
 * 
 * Inserts or modifies a record in a Business Object identified by a KEY.
 * If the KEY does not exist, a record is inserted.
 * 
 * @param objectName - Business Object name (e.g., "CUSTOMER")
 * @param key - Unique identifier (string > 10 chars or existing ID)
 * @param data - Data object with nested arrays matching SoftOne structure
 * @param clientID - SoftOne client ID from authentication
 * @param appId - Application ID
 * @param version - Optional version (defaults to "1")
 * @param locateInfo - Optional LOCATEINFO string for response data
 * 
 * @example
 * ```typescript
 * const result = await setSoftOneData(
 *   "CUSTOMER",
 *   "REFKEY12341234",
 *   {
 *     CUSTOMER: [{
 *       CODE: "100",
 *       NAME: "Company Name",
 *       // ... other fields
 *     }]
 *   },
 *   clientID,
 *   "2001"
 * );
 * ```
 */
export async function setSoftOneData(
  objectName: string,
  key: string,
  data: Record<string, any[]>,
  clientID: string,
  appId: string | number,
  version: string = "1",
  locateInfo?: string
): Promise<{
  success: boolean;
  id?: string | number;
  data?: any;
  error?: string;
}> {
  try {
    if (!clientID) {
      return {
        success: false,
        error: "Not authenticated with SoftOne. Please authenticate first.",
      };
    }

    if (!objectName) {
      return {
        success: false,
        error: "Object name is required",
      };
    }

    // Allow empty key for new record creation (SoftOne will insert if KEY is empty or missing)
    // Only validate key if it's provided and not empty
    if (key !== undefined && key !== null && key.trim() !== "") {
      // Key is provided and not empty, validate it
    }

    if (!data || Object.keys(data).length === 0) {
      return {
        success: false,
        error: "Data is required",
      };
    }

    if (!appId) {
      return {
        success: false,
        error: "appId is required for setData service",
      };
    }

    // Build request payload
    const requestData: any = {
      service: "setData",
      clientID: String(clientID),
      appId: typeof appId === "string" ? Number(appId) : appId,
      OBJECT: String(objectName),
      data: data,
    };

    // Only include KEY if it's not empty (empty KEY means insert new record)
    if (key && key.trim() !== "") {
      requestData.KEY = String(key);
    }

    // Add optional parameters
    if (version) {
      requestData.VERSION = String(version);
    }

    if (locateInfo) {
      requestData.LOCATEINFO = String(locateInfo);
    }

    console.log("=== SoftOne API - SetData Request ===");
    console.log("URL:", SOFTONE_API_URL);
    console.log("Full Request Payload:", JSON.stringify(requestData, null, 2));

    try {
      const response = await fetch(SOFTONE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // Check response status
      if (!response.ok) {
        console.error("SoftOne API - SetData HTTP Error:", response.status, response.statusText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Convert ANSI 1253 to UTF-8 using iconv-lite and ArrayBuffer
      const jsonData = await convertAnsi1253ToUtf8(response);
      const result = JSON.parse(jsonData);

      console.log("SoftOne API - SetData Response:", JSON.stringify(result, null, 2));

      // Check if result has success property
      if (result.success === false) {
        return {
          success: false,
          error: result.error || "Failed to set data",
        };
      }

      if (result.success) {
        return {
          success: true,
          id: result.id,
          data: result.data,
        };
      }

      return {
        success: false,
        error: result.error || "Failed to set data",
      };
    } catch (fetchError) {
      console.error("SoftOne API - SetData Fetch Error:", fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error("SoftOne API - SetData Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set data",
    };
  }
}