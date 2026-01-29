"use client";

import { useEffect, useActionState, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Search } from "lucide-react";
import { createCustomer, updateCustomer, type CustomerFormState } from "@/lib/actions/customers";
import { fetchIRSData } from "@/lib/actions/irs";
import { countries } from "@/lib/data/countries";
import { formFieldStyles } from "@/lib/form-styles";
import { toast } from "sonner";

interface Customer {
  id: number;
  SODTYPE: number;
  TRDR: string | null;
  CODE: string | null;
  NAME: string | null;
  AFM: string | null;
  COUNTRY: string | null;
  ADDRESS: string | null;
  ZIP: string | null;
  CITY: string | null;
  PHONE01: string | null;
  PHONE02: string | null;
  JOBTYPE: string | null;
  WEBPAGE: string | null;
  EMAIL: string | null;
  EMAILACC: string | null;
  IRSDATA: string | null;
  INSDATE: Date | null;
  UPDDATE: Date | null;
}

interface CustomerFormProps {
  mode: "create" | "edit";
  customer?: Customer;
  onSuccess: () => void;
}

export function CustomerForm({ mode, customer, onSuccess }: CustomerFormProps) {
  const boundUpdateCustomer = customer
    ? updateCustomer.bind(null, customer.id)
    : createCustomer;

  const [state, formAction, isPending] = useActionState<CustomerFormState | undefined, FormData>(
    mode === "create" ? createCustomer : boundUpdateCustomer,
    undefined
  );

  // Form field state for controlled inputs (needed for IRS API updates)
  const [name, setName] = useState(customer?.NAME || "");
  const [address, setAddress] = useState(customer?.ADDRESS || "");
  const [zip, setZip] = useState(customer?.ZIP || "");
  const [city, setCity] = useState(customer?.CITY || "");
  const [irsData, setIrsData] = useState(customer?.IRSDATA || "");
  const [jobType, setJobType] = useState(customer?.JOBTYPE || "");
  const [afm, setAfm] = useState(customer?.AFM || "");
  const [isFetchingIRS, setIsFetchingIRS] = useState(false);

  // Refs for form inputs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const irsDataInputRef = useRef<HTMLInputElement>(null);
  const jobTypeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
    if (state?.errors) {
      Object.values(state.errors).forEach((errors) => {
        errors.forEach((error) => toast.error(error));
      });
    }
    if (state?.success) {
      toast.success(mode === "create" ? "Customer created successfully" : "Customer updated successfully");
      onSuccess();
    }
  }, [state, mode, onSuccess]);

  // Handle IRS API lookup
  const handleIRSLookup = async () => {
    if (!afm || afm.trim().length === 0) {
      toast.error("Please enter an AFM first");
      return;
    }

    setIsFetchingIRS(true);
    try {
      const result = await fetchIRSData(afm);
      
      if (!result.success) {
        toast.error(result.error || "Failed to fetch IRS data");
        return;
      }

      if (result.data) {
        // Update form fields with IRS data (always set, even if [object])
        if (result.data.NAME !== undefined) {
          setName(result.data.NAME);
          if (nameInputRef.current) {
            nameInputRef.current.value = result.data.NAME;
          }
        }
        if (result.data.ADDRESS !== undefined) {
          setAddress(result.data.ADDRESS);
          if (addressInputRef.current) {
            addressInputRef.current.value = result.data.ADDRESS;
          }
        }
        if (result.data.ZIP !== undefined) {
          setZip(result.data.ZIP);
          if (zipInputRef.current) {
            zipInputRef.current.value = result.data.ZIP;
          }
        }
        if (result.data.CITY !== undefined) {
          setCity(result.data.CITY);
          if (cityInputRef.current) {
            cityInputRef.current.value = result.data.CITY;
          }
        }
        if (result.data.IRSDATA !== undefined) {
          setIrsData(result.data.IRSDATA);
          if (irsDataInputRef.current) {
            irsDataInputRef.current.value = result.data.IRSDATA;
          }
        }
        if (result.data.JOBTYPE !== undefined) {
          setJobType(result.data.JOBTYPE);
          if (jobTypeInputRef.current) {
            jobTypeInputRef.current.value = result.data.JOBTYPE;
          }
        }

        toast.success("IRS data loaded successfully");
      }
    } catch (error) {
      toast.error("Failed to fetch IRS data");
      console.error("IRS lookup error:", error);
    } finally {
      setIsFetchingIRS(false);
    }
  };

  return (
    <form action={formAction} className="space-y-3">
      {/* Hidden SODTYPE field - always 13 */}
      <input type="hidden" name="SODTYPE" value="13" />

      {/* Basic Information */}
      <div className="space-y-2">
        <h3 className={formFieldStyles.sectionHeader}>
          BASIC INFORMATION
        </h3>
        <div className="space-y-1">
          <Label htmlFor="CODE" className={formFieldStyles.label}>
            CODE
          </Label>
          <Input
            id="CODE"
            name="CODE"
            defaultValue={customer?.CODE || ""}
            disabled={isPending}
            className={formFieldStyles.input}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="NAME" className={formFieldStyles.label}>
            NAME *
          </Label>
          <Input
            id="NAME"
            name="NAME"
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isPending}
            className={formFieldStyles.input}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="TRDR" className={formFieldStyles.label}>
              TRDR
            </Label>
            <Input
              id="TRDR"
              name="TRDR"
              defaultValue={customer?.TRDR || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="AFM" className={formFieldStyles.label}>
              AFM (Tax ID)
            </Label>
            <div className="flex gap-1">
              <Input
                id="AFM"
                name="AFM"
                value={afm}
                onChange={(e) => setAfm(e.target.value)}
                disabled={isPending || isFetchingIRS}
                className={formFieldStyles.input}
                placeholder="Enter AFM"
              />
              <Button
                type="button"
                onClick={handleIRSLookup}
                disabled={isPending || isFetchingIRS || !afm.trim()}
                className={`${formFieldStyles.button} px-2`}
                title="Lookup IRS data"
              >
                {isFetchingIRS ? (
                  <Loader2 className={formFieldStyles.buttonIcon} />
                ) : (
                  <Search className={formFieldStyles.buttonIcon} />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-2">
        <h3 className={formFieldStyles.sectionHeader}>
          CONTACT INFORMATION
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="PHONE01" className={formFieldStyles.label}>
              PHONE 01
            </Label>
            <Input
              id="PHONE01"
              name="PHONE01"
              type="tel"
              defaultValue={customer?.PHONE01 || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="PHONE02" className={formFieldStyles.label}>
              PHONE 02
            </Label>
            <Input
              id="PHONE02"
              name="PHONE02"
              type="tel"
              defaultValue={customer?.PHONE02 || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="EMAIL" className={formFieldStyles.label}>
              EMAIL
            </Label>
            <Input
              id="EMAIL"
              name="EMAIL"
              type="email"
              defaultValue={customer?.EMAIL || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="EMAILACC" className={formFieldStyles.label}>
              EMAIL ACC
            </Label>
            <Input
              id="EMAILACC"
              name="EMAILACC"
              type="email"
              defaultValue={customer?.EMAILACC || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="WEBPAGE" className={formFieldStyles.label}>
            WEBPAGE
          </Label>
          <Input
            id="WEBPAGE"
            name="WEBPAGE"
            type="url"
            defaultValue={customer?.WEBPAGE || ""}
            disabled={isPending}
            className={formFieldStyles.input}
            placeholder="https://"
          />
        </div>
      </div>

      {/* Address Information */}
      <div className="space-y-2">
        <h3 className={formFieldStyles.sectionHeader}>
          ADDRESS INFORMATION
        </h3>
        <div className="space-y-1">
          <Label htmlFor="ADDRESS" className={formFieldStyles.label}>
            ADDRESS
          </Label>
          <Input
            id="ADDRESS"
            name="ADDRESS"
            ref={addressInputRef}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isPending}
            className={formFieldStyles.input}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="CITY" className={formFieldStyles.label}>
              CITY
            </Label>
            <Input
              id="CITY"
              name="CITY"
              ref={cityInputRef}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ZIP" className={formFieldStyles.label}>
              ZIP CODE
            </Label>
            <Input
              id="ZIP"
              name="ZIP"
              ref={zipInputRef}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="COUNTRY" className={formFieldStyles.label}>
              COUNTRY
            </Label>
            <Select name="COUNTRY" defaultValue={customer?.COUNTRY || "GR"}>
              <SelectTrigger className={formFieldStyles.select}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code} className={formFieldStyles.selectItem}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="space-y-2">
        <h3 className={formFieldStyles.sectionHeader}>
          ADDITIONAL INFORMATION
        </h3>
        <div className="space-y-1">
          <Label htmlFor="JOBTYPE" className={formFieldStyles.label}>
            JOB TYPE
          </Label>
          <Input
            id="JOBTYPE"
            name="JOBTYPE"
            ref={jobTypeInputRef}
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            disabled={isPending}
            className={formFieldStyles.input}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="IRSDATA" className={formFieldStyles.label}>
            IRS DATA
          </Label>
          <Input
            id="IRSDATA"
            name="IRSDATA"
            ref={irsDataInputRef}
            value={irsData}
            onChange={(e) => setIrsData(e.target.value)}
            disabled={isPending}
            className={formFieldStyles.input}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="submit" disabled={isPending} className={formFieldStyles.button}>
          {isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {mode === "create" ? "CREATING..." : "SAVING..."}
            </>
          ) : (
            <>
              <Save className="h-3 w-3" />
              {mode === "create" ? "CREATE CUSTOMER" : "SAVE CHANGES"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

