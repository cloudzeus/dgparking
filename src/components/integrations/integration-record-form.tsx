"use client";

import { useState, useEffect } from "react";
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
import { formFieldStyles } from "@/lib/form-styles";
import { Save, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface IntegrationRecordFormProps {
  mode: "create" | "edit";
  record?: any;
  modelName: string;
  modelFields: Array<{
    name: string;
    type: string;
    isId: boolean;
    isUnique: boolean;
    isRequired: boolean;
  }>;
  integrationId: string;
  onSuccess: (newRecord?: any) => void;
}

export function IntegrationRecordForm({
  mode,
  record,
  modelName,
  modelFields,
  integrationId,
  onSuccess,
}: IntegrationRecordFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingAFM, setIsFetchingAFM] = useState(false);
  const [nameFromAFMLookup, setNameFromAFMLookup] = useState(false);
  const [countries, setCountries] = useState<Array<{ value: string; label: string }>>([]);
  const [irsData, setIrsData] = useState<Array<{ value: string; label: string }>>([]);
  const [defaultCountryCode, setDefaultCountryCode] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (mode === "edit" && record) {
      const initial: Record<string, any> = {};
      modelFields.forEach((field) => {
        initial[field.name] = record[field.name] ?? "";
      });
      return initial;
    }
    // For create mode, initialize with empty values
    const initial: Record<string, any> = {};
    modelFields.forEach((field) => {
      if (!field.isId && field.name !== "createdAt" && field.name !== "updatedAt") {
        initial[field.name] = "";
      }
    });
    return initial;
  });

  // Fetch dropdown options for COUNTRY and IRSDATA
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch(`/api/integrations/${integrationId}/options`);
        const data = await response.json();
        if (data.success) {
          setCountries(data.countries || []);
          setIrsData(data.irsData || []);
          
          // Set default country (ΕΛΛΑΔΑ) for create mode
          if (mode === "create" && modelName === "CUSTORMER" && data.defaultCountry) {
            setDefaultCountryCode(data.defaultCountry);
            setFormData((prev) => ({
              ...prev,
              COUNTRY: data.defaultCountry,
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching options:", error);
      }
    };

    if (modelName === "CUSTORMER") {
      fetchOptions();
    }
  }, [integrationId, modelName, mode]);

  // Handle AFM lookup (server-side)
  const handleAFMLookup = async () => {
    const afmValue = formData.AFM || "";
    const afmToUse = afmValue.trim() || "99999999"; // Use default if empty

    setIsFetchingAFM(true);
    try {
      // First check if AFM already exists
      const checkResponse = await fetch("/api/afm/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          afm: afmToUse,
          excludeRecordId: mode === "edit" && record ? record.id : undefined,
        }),
      });

      const checkData = await checkResponse.json();
      
      if (checkData.success && checkData.exists) {
        const existingName = checkData.record?.NAME || "Unknown";
        toast.error(`AFM ${afmToUse} already exists for customer: ${existingName}`);
        setIsFetchingAFM(false);
        return;
      }

      // Call server-side AFM lookup API
      const response = await fetch("/api/afm/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ afm: afmToUse }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch AFM data");
      }

      if (!data.data) {
        toast.error("No data found for this AFM");
        return;
      }

      const mappedData = data.data;

      // Map NAME - mark that it came from AFM lookup
      if (mappedData.NAME) {
        setFormData((prev) => ({ ...prev, NAME: mappedData.NAME }));
        setNameFromAFMLookup(true);
      }

      // Map ADDRESS
      if (mappedData.ADDRESS) {
        setFormData((prev) => ({ ...prev, ADDRESS: mappedData.ADDRESS }));
      }

      // Map ZIP
      if (mappedData.ZIP) {
        setFormData((prev) => ({ ...prev, ZIP: mappedData.ZIP }));
      }

      // Map CITY
      if (mappedData.CITY) {
        setFormData((prev) => ({ ...prev, CITY: mappedData.CITY }));
      }

      // Always set COUNTRY to 1000 (ΕΛΛΑΔΑ) when AFM lookup succeeds
      setFormData((prev) => ({ ...prev, COUNTRY: "1000" }));

      // Map doy_descr to IRSDATA - find matching IRSDATA by NAME
      if (mappedData.IRSDATA && irsData.length > 0) {
        const doyDescr = mappedData.IRSDATA;
        
        // Find IRSDATA where NAME (label) exactly matches doy_descr (case-insensitive)
        const exactMatch = irsData.find((irs) => 
          irs.label && irs.label.toLowerCase().trim() === doyDescr.toLowerCase().trim()
        );
        
        if (exactMatch) {
          setFormData((prev) => ({ ...prev, IRSDATA: exactMatch.value }));
        } else {
          // If no exact match, try to find by partial match (contains)
          const partialMatch = irsData.find((irs) => {
            if (!irs.label) return false;
            const irsLabelLower = irs.label.toLowerCase().trim();
            const doyDescrLower = doyDescr.toLowerCase().trim();
            return irsLabelLower.includes(doyDescrLower) || doyDescrLower.includes(irsLabelLower);
          });
          
          if (partialMatch) {
            setFormData((prev) => ({ ...prev, IRSDATA: partialMatch.value }));
          } else {
            // If still no match, show a warning but don't set IRSDATA
            toast.warning(`IRSDATA "${doyDescr}" not found in our database. Please select manually.`);
          }
        }
      }

      toast.success("AFM data loaded successfully");
    } catch (error) {
      console.error("AFM lookup error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch AFM data");
    } finally {
      setIsFetchingAFM(false);
    }
  };

  // Fields to exclude from form (auto-generated or not editable)
  // CODE is excluded from form but will be auto-generated for new customers
  // Exclude fields based on model type
  const excludedFields = modelName === "CUSTORMER" 
    ? ["SODTYPE", "id", "TRDR", "CODE", "INSDATE", "UPDDATE", "createdAt", "updatedAt"]
    : modelName === "ITEMS"
    ? ["id", "MTRL", "CODE", "SODTYPE", "INSDATE", "UPDDATE", "createdAt", "updatedAt"]
    : modelName === "PAYMENT"
    ? ["PAYMENT", "CODE", "SODTYPE", "INSDATE", "UPDDATE", "createdAt", "updatedAt"]
    : modelName === "INST"
    ? ["INST", "CODE", "INSDATE", "UPDDATE", "createdAt", "updatedAt"]
    : modelName === "INSTLINES"
    ? ["INSTLINES", "INSDATE", "UPDDATE", "createdAt", "updatedAt"]
    : ["SODTYPE", "id", "TRDR", "CODE", "INSDATE", "UPDDATE", "createdAt", "updatedAt"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prepare data for submission - exclude id, createdAt, updatedAt for create
      const submitData: Record<string, any> = {};
      
      // Generate 8-digit random CODE for new CUSTORMER records
      if (mode === "create" && modelName === "CUSTORMER") {
        const randomCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        submitData.CODE = randomCode;
      }

      // Use default AFM value 99999999 if not provided for CUSTORMER
      if (modelName === "CUSTORMER" && (!submitData.AFM || submitData.AFM.trim() === "")) {
        submitData.AFM = "99999999";
      }

      // Check if AFM is valid (not default/empty)
      const hasAFM = modelName === "CUSTORMER" && submitData.AFM && submitData.AFM.trim() !== "" && submitData.AFM !== "99999999";

      // Add prefix "ΠΕΛΑΤΗΣ ΛΙΑΝΙΚΗΣ-" to NAME if:
      // User doesn't insert AFM OR doesn't use AFM lookup button
      if (modelName === "CUSTORMER" && submitData.NAME) {
        const nameValue = String(submitData.NAME).trim();
        const prefix = "ΠΕΛΑΤΗΣ ΛΙΑΝΙΚΗΣ-";
        
        // Add prefix if:
        // 1. NAME doesn't already have the prefix, AND
        // 2. Either AFM is default/empty (99999999) OR AFM lookup was not used
        const shouldAddPrefix = !nameValue.startsWith(prefix) && (!hasAFM || !nameFromAFMLookup);
        
        if (shouldAddPrefix) {
          submitData.NAME = prefix + nameValue;
        }
      }

      // Check if AFM already exists before creating (only for create mode)
      if (mode === "create" && modelName === "CUSTORMER" && submitData.AFM && submitData.AFM !== "99999999") {
        try {
          const checkResponse = await fetch("/api/afm/check", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ afm: submitData.AFM }),
          });

          const checkData = await checkResponse.json();
          
          if (checkData.success && checkData.exists) {
            const existingName = checkData.record?.NAME || "Unknown";
            toast.error(`AFM ${submitData.AFM} already exists for customer: ${existingName}`);
            setIsSubmitting(false);
            return;
          }
        } catch (error) {
          console.error("Error checking AFM:", error);
          // Continue with submission even if check fails
        }
      }
      
      modelFields.forEach((field) => {
        // Skip excluded fields
        if (excludedFields.includes(field.name)) {
          return;
        }
        if (field.name === "createdAt" || field.name === "updatedAt") {
          return; // Skip timestamp fields
        }

        const value = formData[field.name];
        
        // Convert special placeholder value to null
        if (value === "__none__") {
          submitData[field.name] = null;
          return;
        }
        
        // Skip empty values for optional fields
        if (value === "" || value === null || value === undefined) {
          if (!field.isRequired) {
            return; // Skip optional empty fields
          }
        }

        // Convert value based on field type
        if (field.type === "Int") {
          if (value === "" || value === null || value === undefined) {
            submitData[field.name] = field.isRequired ? 0 : null;
          } else {
            submitData[field.name] = parseInt(String(value), 10) || 0;
          }
        } else if (field.type === "Float") {
          if (value === "" || value === null || value === undefined) {
            submitData[field.name] = field.isRequired ? 0 : null;
          } else {
            submitData[field.name] = parseFloat(String(value)) || 0;
          }
        } else if (field.type === "Boolean") {
          submitData[field.name] = Boolean(value);
        } else {
          submitData[field.name] = value || null;
        }
      });

      const getPrimaryKeyField = (modelName: string): string => {
        const primaryKeys: Record<string, string> = {
          CUSTORMER: "id",
          User: "id",
          COUNTRY: "COUNTRY",
          IRSDATA: "IRSDATA",
          VAT: "VAT",
          SOCURRENCY: "SOCURRENCY",
          TRDCATEGORY: "TRDCATEGORY",
          ITEMS: "ITEMS",
          PAYMENT: "PAYMENT",
          INST: "INST",
          INSTLINES: "INSTLINES",
        };
        return primaryKeys[modelName] || "id";
      };

      // For edit mode with two-way sync, use the update endpoint that updates SoftOne first
      const url = mode === "create"
        ? `/api/integrations/${integrationId}/records`
        : `/api/integrations/${integrationId}/records/update`;

      const method = "POST"; // Both use POST, but update endpoint handles PUT logic internally

      // For update, include recordId in body
      const requestBody = mode === "create"
        ? submitData
        : { recordId: record[getPrimaryKeyField(modelName)], data: submitData };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save record");
      }

      toast.success(`Record ${mode === "create" ? "created" : "updated"} successfully`);
      
      // Pass the new/updated record to onSuccess callback
      // This allows parent components to update their state without page reload
      onSuccess(data.record);
      
      // Only refresh if onSuccess doesn't handle the update
      // (for backward compatibility with components that still need refresh)
      if (mode === "edit") {
        router.refresh();
      }
    } catch (error) {
      console.error("Error saving record:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save record");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter fields to show in form (exclude auto-generated and non-editable fields)
  const formFields = modelFields.filter((field) => {
    // Exclude auto-generated and non-editable fields
    if (excludedFields.includes(field.name)) return false;
    if (field.name === "createdAt" || field.name === "updatedAt") return false;
    if (mode === "create" && field.isId) return false; // Don't show ID field in create mode
    return true;
  });

  return (
    <form onSubmit={handleSubmit} className={formFieldStyles.formSpacing}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {formFields.map((field) => {
          const isRequired = field.isRequired && !field.isId;
          const fieldValue = formData[field.name] ?? "";

          if (field.type === "Boolean") {
            return (
              <div key={field.name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={field.name}
                  checked={Boolean(fieldValue)}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [field.name]: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor={field.name} className={formFieldStyles.label}>
                  {field.name.toUpperCase()} {isRequired && "*"}
                </Label>
              </div>
            );
          }

          // Handle COUNTRY dropdown for CUSTORMER model
          // COUNTRY in CUSTORMER is stored as String (country code), but we use COUNTRY model's Int code
          if (modelName === "CUSTORMER" && field.name === "COUNTRY") {
            const currentValue = fieldValue ? String(fieldValue) : undefined;
            return (
              <div key={field.name} className={formFieldStyles.fieldSpacing}>
                <Label htmlFor={field.name} className={formFieldStyles.label}>
                  {field.name.toUpperCase()} {isRequired && "*"}
                </Label>
                <Select
                  value={currentValue}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field.name]: value === "__none__" ? null : value || null,
                    }))
                  }
                >
                  <SelectTrigger className={formFieldStyles.select} suppressHydrationWarning>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {!isRequired && (
                      <SelectItem value="__none__" className={formFieldStyles.selectItem}>
                        None
                      </SelectItem>
                    )}
                    {countries.map((country) => (
                      <SelectItem
                        key={country.value}
                        value={country.value}
                        className={formFieldStyles.selectItem}
                      >
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          // Handle IRSDATA dropdown for CUSTORMER model
          if (modelName === "CUSTORMER" && field.name === "IRSDATA") {
            const currentValue = fieldValue ? String(fieldValue) : undefined;
            return (
              <div key={field.name} className={formFieldStyles.fieldSpacing}>
                <Label htmlFor={field.name} className={formFieldStyles.label}>
                  {field.name.toUpperCase()} {isRequired && "*"}
                </Label>
                <Select
                  value={currentValue}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field.name]: value === "__none__" ? null : value || null,
                    }))
                  }
                >
                  <SelectTrigger className={formFieldStyles.select} suppressHydrationWarning>
                    <SelectValue placeholder="Select IRS data" />
                  </SelectTrigger>
                  <SelectContent>
                    {!isRequired && (
                      <SelectItem value="__none__" className={formFieldStyles.selectItem}>
                        None
                      </SelectItem>
                    )}
                    {irsData.map((irs) => (
                      <SelectItem
                        key={irs.value}
                        value={irs.value}
                        className={formFieldStyles.selectItem}
                      >
                        {irs.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          // Handle AFM field with lookup button for CUSTORMER
          if (modelName === "CUSTORMER" && field.name === "AFM") {
            return (
              <div key={field.name} className={formFieldStyles.fieldSpacing}>
                <Label htmlFor={field.name} className={formFieldStyles.label}>
                  {field.name.toUpperCase()} {isRequired && "*"}
                </Label>
                <div className="flex gap-1">
                  <Input
                    id={field.name}
                    type="text"
                    value={fieldValue}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    className={formFieldStyles.input}
                    required={isRequired}
                    disabled={isSubmitting || isFetchingAFM}
                    placeholder="Enter AFM or leave empty for default (99999999)"
                  />
                  <Button
                    type="button"
                    onClick={handleAFMLookup}
                    disabled={isSubmitting || isFetchingAFM}
                    className={`${formFieldStyles.button} px-2`}
                    title="Lookup AFM data"
                  >
                    {isFetchingAFM ? (
                      <Loader2 className={formFieldStyles.buttonIcon} />
                    ) : (
                      <Search className={formFieldStyles.buttonIcon} />
                    )}
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div key={field.name} className={formFieldStyles.fieldSpacing}>
              <Label htmlFor={field.name} className={formFieldStyles.label}>
                {field.name.toUpperCase()} {isRequired && "*"}
              </Label>
              {field.type === "DateTime" ? (
                <Input
                  id={field.name}
                  type="datetime-local"
                  value={
                    fieldValue
                      ? new Date(fieldValue).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field.name]: e.target.value ? new Date(e.target.value).toISOString() : null,
                    }))
                  }
                  className={formFieldStyles.input}
                  required={isRequired}
                />
              ) : (
                <Input
                  id={field.name}
                  type={
                    field.type === "Int" || field.type === "Float"
                      ? "number"
                      : field.type === "String" && field.name.toLowerCase().includes("email")
                      ? "email"
                      : "text"
                  }
                  value={fieldValue}
                  onChange={(e) => {
                    // If user manually edits NAME after AFM lookup, mark it as manual
                    if (field.name === "NAME" && nameFromAFMLookup) {
                      setNameFromAFMLookup(false);
                    }
                    setFormData((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }));
                  }}
                  className={formFieldStyles.input}
                  required={isRequired}
                  disabled={field.isId && mode === "edit"}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          className={formFieldStyles.button}
          disabled={isSubmitting}
        >
          CANCEL
        </Button>
        <Button type="submit" className={formFieldStyles.button} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className={formFieldStyles.buttonIcon} />
              SAVING...
            </>
          ) : (
            <>
              <Save className={formFieldStyles.buttonIcon} />
              {mode === "create" ? "CREATE RECORD" : "SAVE CHANGES"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}



