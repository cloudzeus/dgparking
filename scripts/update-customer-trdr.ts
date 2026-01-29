import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateCustomerTRDR() {
  try {
    // Find the customer by CODE
    const customer = await prisma.cUSTORMER.findFirst({
      where: {
        CODE: "91369652",
      },
    });

    if (!customer) {
      console.log("Customer with CODE 91369652 not found");
      return;
    }

    console.log("Found customer:", {
      id: customer.id,
      CODE: customer.CODE,
      NAME: customer.NAME,
      TRDR: customer.TRDR,
    });

    // Update the customer with TRDR
    const updated = await prisma.cUSTORMER.update({
      where: {
        id: customer.id,
      },
      data: {
        TRDR: "51415",
      },
    });

    console.log("Customer updated successfully:", {
      id: updated.id,
      CODE: updated.CODE,
      NAME: updated.NAME,
      TRDR: updated.TRDR,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCustomerTRDR();



