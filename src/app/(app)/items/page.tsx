import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ItemsClient } from "@/components/items/items-client";
import type { Prisma } from "@prisma/client";

type ItemRow = Prisma.iTEMSGetPayload<{
  select: { ITEMS: true; MTRL: true; CODE: true; NAME: true; ISACTIVE: true; createdAt: true };
}>;

export default async function ItemsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN, MANAGER, and EMPLOYEE can access
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // OPTIMIZATION: Add limit and select only needed fields for better performance
  // The client-side pagination handles the rest, but we limit initial load
  const MAX_ITEMS_INITIAL = 2000; // Limit initial fetch
  
  let items: ItemRow[] = [];
  try {
    items = await prisma.iTEMS.findMany({
      select: {
        ITEMS: true,
        MTRL: true,
        CODE: true,
        NAME: true,
        ISACTIVE: true,
        createdAt: true,
        // Only select fields needed for display
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS_INITIAL, // Limit initial fetch
    });
  } catch (error) {
    console.error("[ITEMS-PAGE] Database error fetching items:", error);
    // Return empty array if database connection fails - page will show "No items found"
    items = [];
  }

  // OPTIMIZATION: Only fetch ITEMS integration instead of all integrations
  // Fetch all integrations and filter in memory (MySQL JSON path limitation)
  // But limit to only what we need
  let itemsIntegration = null;
  try {
    const allIntegrations = await prisma.softOneIntegration.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        configJson: true,
        connection: {
          select: {
            id: true,
            name: true,
            registeredName: true,
          },
        },
      },
    });

    // Filter for ITEMS integration in JavaScript
    itemsIntegration = allIntegrations.find((integration) => {
      const config = integration.configJson as any;
      return config?.modelMapping?.modelName === "ITEMS";
    }) || null;
  } catch (error) {
    console.error("[ITEMS-PAGE] Error fetching integration:", error);
  }

  // Define ITEMS model fields locally (same as in /api/models route)
  const modelFields: Array<{
    name: string;
    type: string;
    isId: boolean;
    isUnique: boolean;
    isRequired: boolean;
  }> = [
    { name: "ITEMS", type: "Int", isId: true, isUnique: false, isRequired: true },
    { name: "COMPANY", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "SODTYPE", type: "Int", isId: false, isUnique: false, isRequired: false },
    { name: "MTRL", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "CODE", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "CODE1", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "CODE2", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "RELITEM", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
    { name: "MTRTYPE1", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRACN", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRCATEGORY", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "VAT", type: "Int", isId: false, isUnique: false, isRequired: false },
    { name: "MTRUNIT1", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRUNIT2", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRUNIT3", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRUNIT4", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MU21", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "MU31", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "MU41", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "MU12MODE", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MU13MODE", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MU14MODE", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRGROUP", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRMANFCTR", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "COUNTRY", type: "Int", isId: false, isUnique: false, isRequired: false },
    { name: "MTRMARK", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "MTRMODEL", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "SOCURRENCY", type: "Int", isId: false, isUnique: false, isRequired: false },
    { name: "INTRASTAT", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "WEIGHT", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "WEBPAGE", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "WEBNAME", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "WEBVIEW", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "PRICEW", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "PRICER", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "DIM1", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "DIM2", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "DIM3", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "DIMMD", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "DIMMTRUNIT", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "SALQTY", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "PURQTY", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "ITEQTY", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "INSDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
    { name: "UPDDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
    { name: "GWEIGHT", type: "Float", isId: false, isUnique: false, isRequired: false },
    { name: "MCOUNTRY", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "KADTAXIS", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "cccSubgoup2", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "cccSubgroup3", type: "String", isId: false, isUnique: false, isRequired: false },
    { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
  ];

  return (
    <ItemsClient
      items={items}
      currentUserRole={session.user.role}
      itemsIntegration={itemsIntegration}
      modelFields={modelFields}
    />
  );
}


