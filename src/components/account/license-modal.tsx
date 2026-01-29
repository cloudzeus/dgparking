"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formFieldStyles } from "@/lib/form-styles";

export interface LicenseData {
  buyerName: string;
  buyerVat: string;
  buyerSerial: string;
  activationDateFormatted: string;
  sellerName: string;
  sellerVat: string;
}

interface LicenseModalProps {
  license: LicenseData;
  open: boolean;
}

export function LicenseModal({ license, open }: LicenseModalProps) {
  const router = useRouter();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      router.push("/account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase">
            Software License Certificate
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-[11px]">
          <p className="text-muted-foreground">
            This document serves as the official license grant for the software
            product provided by {license.sellerName}.
          </p>

          <div>
            <h3 className={formFieldStyles.sectionHeader}>License Information</h3>
            <table className="w-full border-collapse mt-2 text-[10px]">
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 font-medium text-muted-foreground w-1/3">
                    Field
                  </td>
                  <td className="py-2 font-medium">Detail</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 text-muted-foreground">
                    Licensee (Buyer)
                  </td>
                  <td className="py-2">{license.buyerName}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 text-muted-foreground">Buyer VAT</td>
                  <td className="py-2">{license.buyerVat}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 text-muted-foreground">
                    Serial Number
                  </td>
                  <td className="py-2">{license.buyerSerial}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 text-muted-foreground">
                    Activation Date
                  </td>
                  <td className="py-2">{license.activationDateFormatted}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className={formFieldStyles.sectionHeader}>Grant of License</h3>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              Subject to the terms and conditions of this agreement,{" "}
              {license.sellerName} (Seller VAT: {license.sellerVat}) hereby
              grants {license.buyerName} a non-exclusive, non-transferable
              license to use the software associated with the serial number
              provided above.
            </p>
          </div>

          <div>
            <h3 className={formFieldStyles.sectionHeader}>Terms of Use</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
              <li>
                This license is valid starting from the Activation Date
                specified.
              </li>
              <li>
                The license is tied to the entity identified by the Buyer VAT.
              </li>
              <li>
                Any unauthorized distribution, reverse engineering, or
                modification of the software is strictly prohibited.
              </li>
            </ul>
          </div>

          <p className="text-muted-foreground text-[10px] border-t border-border pt-3">
            Note: Please keep this license information and your unique serial
            number in a secure location. You may be required to provide these
            details for future software updates or technical support.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
