"use client";

import { useEffect, useActionState, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Search } from "lucide-react";
import { createCustomer, updateCustomer, type CustomerFormState } from "@/lib/actions/customers";
import { fetchIRSData } from "@/lib/actions/irs";
import { countries } from "@/lib/data/countries";
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
      toast.success(mode === "create" ? "Ο πελάτης δημιουργήθηκε" : "Ο πελάτης ενημερώθηκε");
      onSuccess();
    }
  }, [state, mode, onSuccess]);

  // Handle IRS API lookup
  const handleIRSLookup = async () => {
    if (!afm || afm.trim().length === 0) {
      toast.error("Συμπληρώστε πρώτα το ΑΦΜ");
      return;
    }

    setIsFetchingIRS(true);
    try {
      const result = await fetchIRSData(afm);
      
      if (!result.success) {
        toast.error(result.error || "Η ανάκτηση στοιχείων από το Μητρώο απέτυχε");
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

        toast.success("Τα στοιχεία του Μητρώου φορτώθηκαν");
      }
    } catch (error) {
      toast.error("Η ανάκτηση στοιχείων από το Μητρώο απέτυχε");
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
        <h3 className="text-xs font-semibold text-muted-foreground">
          Βασικά στοιχεία
        </h3>
        <div className="space-y-1">
          <Label htmlFor="CODE" className="text-xs">
            Κωδικός (CODE)
          </Label>
          <Input
            id="CODE"
            name="CODE"
            defaultValue={customer?.CODE || ""}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="NAME" className="text-xs">
            Επωνυμία (NAME) *
          </Label>
          <Input
            id="NAME"
            name="NAME"
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="TRDR" className="text-xs">
              TRDR
            </Label>
            <Input
              id="TRDR"
              name="TRDR"
              defaultValue={customer?.TRDR || ""}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="AFM" className="text-xs">
              ΑΦΜ (AFM)
            </Label>
            <div className="flex gap-1">
              <Input
                id="AFM"
                name="AFM"
                value={afm}
                onChange={(e) => setAfm(e.target.value)}
                disabled={isPending || isFetchingIRS}
                placeholder="Εισαγωγή ΑΦΜ"
              />
              <Button
                type="button"
                onClick={handleIRSLookup}
                disabled={isPending || isFetchingIRS || !afm.trim()}
                title="Άντληση στοιχείων από το Μητρώο"
                aria-label="Άντληση στοιχείων από το Μητρώο"
                size="icon"
              >
                {isFetchingIRS ? <Spinner /> : <Search />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">
          Στοιχεία επικοινωνίας
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="PHONE01" className="text-xs">
              Τηλέφωνο (PHONE01)
            </Label>
            <Input
              id="PHONE01"
              name="PHONE01"
              type="tel"
              defaultValue={customer?.PHONE01 || ""}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="PHONE02" className="text-xs">
              Τηλέφωνο 2 (PHONE02)
            </Label>
            <Input
              id="PHONE02"
              name="PHONE02"
              type="tel"
              defaultValue={customer?.PHONE02 || ""}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="EMAIL" className="text-xs">
              Email (EMAIL)
            </Label>
            <Input
              id="EMAIL"
              name="EMAIL"
              type="email"
              defaultValue={customer?.EMAIL || ""}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="EMAILACC" className="text-xs">
              Email λογιστηρίου (EMAILACC)
            </Label>
            <Input
              id="EMAILACC"
              name="EMAILACC"
              type="email"
              defaultValue={customer?.EMAILACC || ""}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="WEBPAGE" className="text-xs">
            Ιστοσελίδα (WEBPAGE)
          </Label>
          <Input
            id="WEBPAGE"
            name="WEBPAGE"
            type="url"
            defaultValue={customer?.WEBPAGE || ""}
            disabled={isPending}
            placeholder="https://"
          />
        </div>
      </div>

      {/* Address Information */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">
          Διεύθυνση
        </h3>
        <div className="space-y-1">
          <Label htmlFor="ADDRESS" className="text-xs">
            Οδός (ADDRESS)
          </Label>
          <Input
            id="ADDRESS"
            name="ADDRESS"
            ref={addressInputRef}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="CITY" className="text-xs">
              Πόλη (CITY)
            </Label>
            <Input
              id="CITY"
              name="CITY"
              ref={cityInputRef}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ZIP" className="text-xs">
              Τ.Κ. (ZIP)
            </Label>
            <Input
              id="ZIP"
              name="ZIP"
              ref={zipInputRef}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="COUNTRY" className="text-xs">
              Χώρα (COUNTRY)
            </Label>
            <Select name="COUNTRY" defaultValue={customer?.COUNTRY || "GR"}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Επιλογή χώρας" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code} >
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
        <h3 className="text-xs font-semibold text-muted-foreground">
          Πρόσθετα στοιχεία
        </h3>
        <div className="space-y-1">
          <Label htmlFor="JOBTYPE" className="text-xs">
            Δραστηριότητα (JOBTYPE)
          </Label>
          <Input
            id="JOBTYPE"
            name="JOBTYPE"
            ref={jobTypeInputRef}
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="IRSDATA" className="text-xs">
            Στοιχεία Μητρώου (IRSDATA)
          </Label>
          <Input
            id="IRSDATA"
            name="IRSDATA"
            ref={irsDataInputRef}
            value={irsData}
            onChange={(e) => setIrsData(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {mode === "create" ? "Δημιουργία…" : "Αποθήκευση…"}
            </>
          ) : (
            <>
              <Save />
              {mode === "create" ? "Δημιουργία πελάτη" : "Αποθήκευση αλλαγών"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

