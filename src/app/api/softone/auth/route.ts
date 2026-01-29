import { NextResponse } from "next/server";
import { authenticateSoftOneAPI, getSoftOneClientId } from "@/lib/softone-api";

/**
 * API route for SoftOne ERP authentication
 * This route calls the SoftOne API directly and stores clientID in session
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, appId, company, branch, registeredName } = body;

    console.log("SoftOne Auth API - Received credentials:", {
      username,
      appId,
      company,
      passwordLength: password?.length,
    });

    if (!username || !password || !appId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing required credentials (username, password, appId)",
          response: null,
        },
        { status: 400 }
      );
    }

    // Call SoftOne API directly
    const result = await authenticateSoftOneAPI(
      username,
      password,
      appId,
      company || "1001",
      branch || "1000",
      undefined, // module (uses default)
      undefined, // refId (uses default)
      undefined, // version (uses default)
      registeredName || process.env.SOFTONE_registeredName
    );

    console.log("SoftOne Auth API - Response:", JSON.stringify(result, null, 2));

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Authentication failed",
          response: result,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      clientID: result.clientID,
      s1u: result.s1u,
      hyperlinks: result.hyperlinks,
      canexport: result.canexport,
      companyinfo: result.companyinfo,
      message: "Authentication successful. ClientID stored in session.",
    });
  } catch (error) {
    console.error("SoftOne authentication error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
        response: null,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check authentication status and clientID
 */
export async function GET() {
  const clientID = await getSoftOneClientId();
  const credentials = {
    company: process.env.SOFTONE_company || "",
    username: process.env.SOFTONE_username || "",
    appId: process.env.SOFTONE_appId || "",
    apiUrl: process.env.SOFTONE_apiUrl || "",
    hasPassword: !!process.env.SOFTONE_password,
  };

  return NextResponse.json({
    configured: !!(
      credentials.username &&
      credentials.hasPassword &&
      credentials.appId &&
      credentials.apiUrl
    ),
    authenticated: !!clientID,
    clientID: clientID ? clientID.substring(0, 20) + "..." : null,
    credentials: {
      ...credentials,
      password: undefined, // Never expose password
    },
  });
}

