import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI } from "@/lib/softone-api";
import { encrypt } from "@/lib/encryption";

/**
 * POST /api/softone/login-authenticate
 * 
 * SERVER-SIDE API ROUTE - All SoftOne API calls are made server-side only.
 * 
 * Authenticates with SoftOne ERP API and optionally saves connection to database.
 * This route calls authenticateSoftOneAPI() which makes the actual SoftOne API request server-side.
 * 
 * Client components should call this route, never call SoftOne API directly.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { registeredName, username, password, appId, company, branch, module, refid, saveConnection, connectionName } = body;

    if (!registeredName || !username || !password || !appId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: registeredName, username, password, appId" },
        { status: 400 }
      );
    }

    // Authenticate with SoftOne
    const result = await authenticateSoftOneAPI(
      username,
      password,
      String(appId),
      company ? String(company) : undefined,
      branch ? String(branch) : undefined,
      module ? String(module) : undefined,
      refid ? String(refid) : undefined,
      undefined, // version (uses default)
      registeredName
    );

    if (!result.success || !result.clientID) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Authentication failed",
        },
        { status: 401 }
      );
    }

    // Extract company, branch, module, refid from companyinfo if available
    let extractedCompany = company || 1001;
    let extractedBranch = branch || 1000;
    let extractedModule = module || 0;
    let extractedRefid = refid || 15;

    if (result.companyinfo) {
      extractedCompany = result.companyinfo.COMPANY || extractedCompany;
      extractedBranch = result.companyinfo.BRANCH || extractedBranch;
      extractedModule = result.companyinfo.MODULE || extractedModule;
      extractedRefid = result.companyinfo.REFID || extractedRefid;
    }

    const response: {
      success: boolean;
      clientID: string;
      appId: number;
      company: number;
      branch: number;
      module: number;
      refid: number;
      connectionId?: string;
    } = {
      success: true,
      clientID: result.clientID,
      appId: Number(appId),
      company: Number(extractedCompany),
      branch: Number(extractedBranch),
      module: Number(extractedModule),
      refid: Number(extractedRefid),
    };

    // Optionally save connection to database
    if (saveConnection && connectionName) {
      try {
        const connection = await prisma.softOneConnection.create({
          data: {
            userId: session.user.id,
            name: connectionName,
            registeredName,
            username,
            passwordEnc: encrypt(password),
            appId: Number(appId),
            company: Number(extractedCompany),
            branch: Number(extractedBranch),
            module: Number(extractedModule),
            refid: Number(extractedRefid),
          },
        });
        response.connectionId = connection.id;
      } catch (error) {
        console.error("Failed to save connection:", error);
        // Don't fail the request if saving connection fails
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("SoftOne login-authenticate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 500 }
    );
  }
}








