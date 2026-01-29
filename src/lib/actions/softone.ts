"use server";

import { z } from "zod";
import { authenticateSoftOneAPI, getSoftOneClientId } from "@/lib/softone-api";

// Validation schema for SoftOne credentials
const softoneLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  appId: z.string().min(1, "App ID is required"),
  company: z.string().optional(),
  branch: z.string().optional(),
});

export type SoftOneLoginState = {
  error?: string;
  success?: boolean;
  session?: {
    clientID: string;
    s1u?: number;
    hyperlinks?: number;
    canexport?: number;
    companyinfo?: string;
  };
  response?: any; // Raw response from SoftOne API
};

/**
 * Authenticate with SoftOne ERP system using direct API call
 * Stores clientID in server session (cookies)
 */
export async function authenticateSoftOne(
  prevState: SoftOneLoginState | undefined,
  formData?: FormData
): Promise<SoftOneLoginState> {
  try {
    // Get credentials from environment variables or form data
    const username = formData?.get("username")?.toString() || process.env.SOFTONE_username;
    const password = formData?.get("password")?.toString() || process.env.SOFTONE_password;
    const appId = formData?.get("appId")?.toString() || process.env.SOFTONE_appId;
    const company = formData?.get("company")?.toString() || process.env.SOFTONE_company || "1001";
    const branch = formData?.get("branch")?.toString() || "1000";
    const registeredName = formData?.get("registeredName")?.toString() || process.env.SOFTONE_registeredName;

    if (!username || !password || !appId) {
      return {
        error: "Missing SoftOne credentials. Please check environment variables.",
      };
    }

    // Validate credentials
    const validatedFields = softoneLoginSchema.safeParse({
      username,
      password,
      appId,
      company,
    });

    if (!validatedFields.success) {
      return {
        error: "Invalid credentials format",
      };
    }

    // Call SoftOne API directly
    const result = await authenticateSoftOneAPI(
      username,
      password,
      appId,
      company,
      branch,
      undefined, // module (uses default)
      undefined, // refId (uses default)
      undefined, // version (uses default)
      registeredName
    );

    console.log("SoftOne Authentication Result:", JSON.stringify(result, null, 2));

    if (!result.success) {
      return {
        error: result.error || "Authentication failed",
        response: result,
      };
    }

    return {
      success: true,
      session: {
        clientID: result.clientID,
        s1u: result.s1u,
        hyperlinks: result.hyperlinks,
        canexport: result.canexport,
        companyinfo: result.companyinfo,
      },
      response: result,
    };
  } catch (error) {
    console.error("SoftOne authentication error:", error);
    return {
      error: error instanceof Error ? error.message : "Authentication failed",
    };
  }
}

/**
 * Test authentication with SoftOne ERP using environment variables
 * This function will be called on page load to test the connection
 */
export async function testSoftOneAuthentication() {
  try {
    const username = process.env.SOFTONE_username;
    const password = process.env.SOFTONE_password;
    const appId = process.env.SOFTONE_appId;
    const company = process.env.SOFTONE_company || "1001";

    if (!username || !password || !appId) {
      return {
        success: false,
        error: "Missing SoftOne credentials in environment variables",
        response: null,
      };
    }

    // Check if we already have a clientID in session
    const existingClientID = await getSoftOneClientId();
    if (existingClientID) {
      console.log("SoftOne - Using existing clientID from session");
      return {
        success: true,
        error: null,
        response: {
          clientID: existingClientID.substring(0, 20) + "...",
          message: "Already authenticated",
        },
      };
    }

    // Call SoftOne API directly
    const registeredName = process.env.SOFTONE_registeredName;
    const result = await authenticateSoftOneAPI(
      username,
      password,
      appId,
      company,
      undefined, // branch (uses default)
      undefined, // module (uses default)
      undefined, // refId (uses default)
      undefined, // version (uses default)
      registeredName
    );

    console.log("SoftOne Test Authentication Result:", JSON.stringify(result, null, 2));

    return {
      success: result.success,
      error: result.error || null,
      response: result,
    };
  } catch (error) {
    console.error("SoftOne test authentication error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Authentication failed",
      response: null,
    };
  }
}

/**
 * Get SoftOne credentials from environment variables
 */
export async function getSoftOneCredentials() {
  const clientID = await getSoftOneClientId();
  return {
    company: process.env.SOFTONE_company || "",
    username: process.env.SOFTONE_username || "",
    password: process.env.SOFTONE_password ? "***" : "", // Mask password
    appId: process.env.SOFTONE_appId || "",
    apiUrl: process.env.SOFTONE_apiUrl || "",
    hasClientID: !!clientID,
    clientID: clientID ? clientID.substring(0, 20) + "..." : null,
  };
}

