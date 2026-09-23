"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronRight, ChevronLeft, Database, Save, Search, CheckSquare, Square, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState, InfoPanel, InfoRow } from "@/components/admin/page";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import gsap from "gsap";

type Step = "AUTH" | "OBJECT" | "TABLE" | "FIELDS" | "MAPPING" | "SCHEDULE" | "SAVE";

interface SoftOneIntegrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConnectionId?: string;
  initialIntegration?: {
    id: string;
    name: string;
    objectName: string;
    objectCaption?: string | null;
    tableName: string;
    tableDbname: string;
    tableCaption?: string | null;
    configJson: Record<string, any>;
    connection: {
      id: string;
      name: string;
    };
  };
  userId: string;
  onCreated?: (integration: { id: string; name: string }) => void;
}

interface AuthData {
  registeredName: string;
  username: string;
  password: string;
  appId: string;
  company?: string;
  branch?: string;
  module?: string;
  refid?: string;
  connectionName?: string;
  saveConnection: boolean;
}

interface ObjectData {
  name: string;
  caption: string;
  type: string;
}

interface TableData {
  name: string;
  dbname: string;
  caption: string;
}

export function SoftOneIntegrationWizard({
  open,
  onOpenChange,
  initialConnectionId,
  initialIntegration,
  userId,
  onCreated,
}: SoftOneIntegrationWizardProps) {
  const [step, setStep] = useState<Step>("AUTH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth step state
  const [authData, setAuthData] = useState<AuthData>({
    registeredName: "",
    username: "",
    password: "",
    appId: "",
    company: "",
    branch: "",
    module: "",
    refid: "",
    connectionName: "",
    saveConnection: false,
  });
  const [authResult, setAuthResult] = useState<{
    clientID: string;
    appId: number;
    company: number;
    branch: number;
    module: number;
    refid: number;
    connectionId?: string;
  } | null>(null);

  // Object step state
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [selectedObject, setSelectedObject] = useState<ObjectData | null>(null);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [objectSearchQuery, setObjectSearchQuery] = useState("");

  // Table step state
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);

  // Fields step state
  const [fields, setFields] = useState<Array<{
    name: string;
    alias: string;
    fullname: string;
    caption: string;
    type: string;
    size?: number;
    visible: boolean;
    required: boolean;
    readOnly: boolean;
  }>>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldSearchQuery, setFieldSearchQuery] = useState("");
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableKeys, setTableKeys] = useState<string[]>([]);
  const [loadingTableData, setLoadingTableData] = useState(false);
  const [tableDataCount, setTableDataCount] = useState<number | null>(null);

  // Mapping step state
  const [models, setModels] = useState<Array<{
    name: string;
    displayName: string;
    description: string;
    fields: Array<{
      name: string;
      type: string;
      isId: boolean;
      isUnique: boolean;
      isRequired: boolean;
    }>;
  }>>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}); // SoftOne field -> Model field
  const [uniqueIdentifierERP, setUniqueIdentifierERP] = useState<string>(""); // SoftOne/ERP field name
  const [uniqueIdentifierModel, setUniqueIdentifierModel] = useState<string>(""); // Model field name
  const [syncDirection, setSyncDirection] = useState<"one-way" | "two-way">("one-way"); // Sync direction
  const [loadingModels, setLoadingModels] = useState(false);

  // Schedule step state
  const [scheduleType, setScheduleType] = useState<"preset" | "custom">("preset");
  const [presetSchedule, setPresetSchedule] = useState<string>("hourly"); // hourly, daily, weekly, etc.
  const [customCron, setCustomCron] = useState<string>("0 * * * *"); // Custom cron expression
  const [scheduleTime, setScheduleTime] = useState<string>("09:00"); // For daily/weekly schedules
  const [scheduleDay, setScheduleDay] = useState<string>("1"); // For weekly schedules (1-7, Monday-Sunday)

  // Save step state
  const [integrationName, setIntegrationName] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});
  const [savedIntegrationId, setSavedIntegrationId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // Reset wizard when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Reset all state when closing
      setStep("AUTH");
      setError(null);
      setAuthData({
        registeredName: "",
        username: "",
        password: "",
        appId: "",
        company: "",
        branch: "",
        module: "",
        refid: "",
        connectionName: "",
        saveConnection: false,
      });
      setAuthResult(null);
      setObjects([]);
      setSelectedObject(null);
      setObjectSearchQuery("");
      setTables([]);
      setSelectedTable(null);
      setFields([]);
      // Clear selected fields (MYDUMMY will be filtered out automatically)
      setSelectedFields([]);
      setFieldSearchQuery("");
      setTableData([]);
      setTableKeys([]);
      setTableDataCount(null);
      setModels([]);
      setSelectedModel("");
      setFieldMappings({});
      setUniqueIdentifierERP("");
      setUniqueIdentifierModel("");
      setSyncDirection("one-way");
      setScheduleType("preset");
      setPresetSchedule("hourly");
      setCustomCron("0 * * * *");
      setScheduleTime("09:00");
      setScheduleDay("1");
      setIntegrationName("");
      setConfig({});
      setSavedIntegrationId(null);
      setImporting(false);
    } else if (open && initialIntegration) {
      // Pre-fill wizard with existing integration data for editing
      setIntegrationName(initialIntegration.name);
      setSavedIntegrationId(initialIntegration.id);
      
      const config = initialIntegration.configJson || {};
      const modelMapping = config.modelMapping || {};
      const schedule = config.schedule || {};
      
      // Set object and table from existing integration
      if (initialIntegration.objectName) {
        setSelectedObject({
          name: initialIntegration.objectName,
          caption: initialIntegration.objectCaption || initialIntegration.objectName,
          type: "object", // Default type
        });
      }
      
      if (initialIntegration.tableName && initialIntegration.tableDbname) {
        setSelectedTable({
          name: initialIntegration.tableName,
          caption: initialIntegration.tableCaption || initialIntegration.tableName,
          dbname: initialIntegration.tableDbname,
        });
      }
      
      // Set model and mappings
      if (modelMapping.modelName) {
        setSelectedModel(modelMapping.modelName);
      }
      if (modelMapping.fieldMappings) {
        setFieldMappings(modelMapping.fieldMappings);
      }
      if (modelMapping.uniqueIdentifier) {
        setUniqueIdentifierERP(modelMapping.uniqueIdentifier.erpField || "");
        setUniqueIdentifierModel(modelMapping.uniqueIdentifier.modelField || "");
      }
      if (modelMapping.syncDirection) {
        setSyncDirection(modelMapping.syncDirection);
      }
      
      // Set schedule
      if (schedule.type) {
        setScheduleType(schedule.type);
      }
      if (schedule.presetSchedule) {
        setPresetSchedule(schedule.presetSchedule);
      }
      if (schedule.customCron) {
        setCustomCron(schedule.customCron);
      }
      if (schedule.scheduleTime) {
        setScheduleTime(schedule.scheduleTime);
      }
      if (schedule.scheduleDay) {
        setScheduleDay(schedule.scheduleDay);
      }
      
      // Set selected fields (deduplicate in case of duplicates)
      if (config.selectedFields) {
        const raw = config.selectedFields as string[];
        const cleanedFields = [...new Set(raw)]
          .filter((field: string) => field && field.trim() !== "" && field.toUpperCase() !== "MYDUMMY") as string[];
        setSelectedFields(cleanedFields);
      }
      
      // Start at MAPPING step if editing (user can navigate back if needed)
      if (initialConnectionId) {
        setStep("MAPPING");
      }
    } else if (initialConnectionId && authResult?.connectionId === initialConnectionId) {
      // If we have an initial connection ID, skip auth step
      setStep("OBJECT");
    }
  }, [open, initialConnectionId, initialIntegration]);

  // Animate step transitions
  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }
      );
    }
  }, [step]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/softone/login-authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registeredName: authData.registeredName,
          username: authData.username,
          password: authData.password,
          appId: authData.appId,
          company: authData.company || undefined,
          branch: authData.branch || undefined,
          module: authData.module || undefined,
          refid: authData.refid || undefined,
          saveConnection: authData.saveConnection,
          connectionName: authData.connectionName || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Η ταυτοποίηση απέτυχε");
        toast.error(data.error || "Η ταυτοποίηση απέτυχε");
        return;
      }

      setAuthResult(data);
      toast.success("Η ταυτοποίηση ολοκληρώθηκε");
      setStep("OBJECT");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η ταυτοποίηση απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadObjects = async () => {
    setLoadingObjects(true);
    setError(null);

    try {
      const response = await fetch("/api/softone/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: authResult?.connectionId || initialConnectionId,
          clientID: authResult?.clientID,
          appId: authResult?.appId || authData.appId, // Pass appId from auth result or form data
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Η φόρτωση των αντικειμένων απέτυχε");
        toast.error(data.error || "Η φόρτωση των αντικειμένων απέτυχε");
        return;
      }

      setObjects(data.objects || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η φόρτωση των αντικειμένων απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingObjects(false);
    }
  };

  useEffect(() => {
    if (step === "OBJECT" && (authResult?.clientID || initialConnectionId)) {
      loadObjects();
    }
  }, [step, authResult?.clientID, initialConnectionId]);

  const handleObjectSelect = (objectName: string) => {
    const obj = objects.find((o) => o.name === objectName);
    if (obj) {
      setSelectedObject(obj);
      setStep("TABLE");
    }
  };

  const loadTables = async () => {
    if (!selectedObject) return;

    setLoadingTables(true);
    setError(null);

    try {
      const response = await fetch("/api/softone/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: authResult?.connectionId || initialConnectionId,
          clientID: authResult?.clientID,
          appId: authResult?.appId || authData.appId, // Pass appId from auth result or form data
          objectName: selectedObject.name,
          version: "1", // Default version
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Η φόρτωση των πινάκων απέτυχε");
        toast.error(data.error || "Η φόρτωση των πινάκων απέτυχε");
        return;
      }

      setTables(data.tables || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η φόρτωση των πινάκων απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (step === "TABLE" && selectedObject) {
      loadTables();
    }
  }, [step, selectedObject]);

  const handleTableSelect = (tableName: string) => {
    const table = tables.find((t) => t.name === tableName);
    if (table) {
      setSelectedTable(table);
      setStep("FIELDS");
    }
  };

  const loadFields = async () => {
    if (!selectedObject || !selectedTable) return;

    setLoadingFields(true);
    setError(null);

    try {
      const response = await fetch("/api/softone/table-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: authResult?.connectionId || initialConnectionId,
          clientID: authResult?.clientID,
          appId: authResult?.appId || authData.appId,
          objectName: selectedObject.name,
          tableName: selectedTable.name,
          version: "1",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Η φόρτωση των πεδίων απέτυχε");
        toast.error(data.error || "Η φόρτωση των πεδίων απέτυχε");
        return;
      }

      setFields(data.fields || []);
      // All fields start unchecked - user must manually select
      setSelectedFields([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η φόρτωση των πεδίων απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    if (step === "FIELDS" && selectedObject && selectedTable) {
      loadFields();
    }
  }, [step, selectedObject, selectedTable]);

  const loadModels = async () => {
    setLoadingModels(true);
    setError(null);

    try {
      const response = await fetch("/api/models");
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Η φόρτωση των μοντέλων απέτυχε");
        toast.error(data.error || "Η φόρτωση των μοντέλων απέτυχε");
        return;
      }

      setModels(data.models || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η φόρτωση των μοντέλων απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (step === "MAPPING") {
      loadModels();
    }
  }, [step]);

  const toggleFieldSelection = (fieldName: string) => {
    // Prevent adding MYDUMMY or empty fields
    if (!fieldName || fieldName.trim() === "" || fieldName.toUpperCase() === "MYDUMMY") {
      return;
    }
    
    setSelectedFields((prev) => {
      // Remove MYDUMMY and empty fields from previous state
      const cleaned = prev.filter((f) => f && f.trim() !== "" && f.toUpperCase() !== "MYDUMMY");
      
      if (cleaned.includes(fieldName)) {
        // Remove all occurrences of the field (in case duplicates exist)
        return cleaned.filter((f) => f !== fieldName);
      } else {
        // Add field (already checked it's not present)
        return [...cleaned, fieldName];
      }
    });
  };

  const handleGetTableData = async () => {
    if (!selectedTable || selectedFields.length === 0) {
      toast.error("Επιλέξτε τουλάχιστον ένα πεδίο");
      return;
    }

    setLoadingTableData(true);
    setError(null);

    try {
      const fieldsString = selectedFields.join(",");
      const response = await fetch("/api/softone/get-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: authResult?.connectionId || initialConnectionId,
          clientID: authResult?.clientID,
          appId: authResult?.appId || authData.appId,
          tableName: selectedTable.dbname || selectedTable.name,
          fields: fieldsString,
          filter: "1=1",
          version: "1",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Η ανάκτηση δεδομένων του πίνακα απέτυχε");
        toast.error(data.error || "Η ανάκτηση δεδομένων του πίνακα απέτυχε");
        return;
      }

      // Transform data: SoftOne returns data as array of arrays with keys array
      // Convert to array of objects for easier display
      // Ensure keys is always an array
      const keys = Array.isArray(data.keys) ? data.keys : (Array.isArray(selectedFields) ? selectedFields : []);
      let transformedData: any[] = [];

      console.log("SoftOne Table Data Response:", {
        keys: data.keys,
        keysIsArray: Array.isArray(data.keys),
        selectedFields,
        dataLength: data.data?.length,
        firstRow: data.data?.[0],
        dataType: Array.isArray(data.data?.[0]) ? 'array' : typeof data.data?.[0],
      });

      if (data.data && Array.isArray(data.data)) {
        if (data.data.length > 0 && Array.isArray(data.data[0])) {
          // Data is array of arrays - transform to array of objects
          transformedData = data.data.map((row: any[]) => {
            const rowObj: any = {};
            if (Array.isArray(keys) && keys.length > 0) {
              keys.forEach((key: string, index: number) => {
                rowObj[key] = row[index] ?? null;
              });
            } else if (Array.isArray(selectedFields) && selectedFields.length > 0) {
              // Fallback to selectedFields if keys is not available
              selectedFields.forEach((fieldName: string, index: number) => {
                rowObj[fieldName] = row[index] ?? null;
              });
            }
            return rowObj;
          });
        } else if (data.data.length > 0 && typeof data.data[0] === 'object' && !Array.isArray(data.data[0])) {
          // Data is already array of objects - use as is, but ensure field names match
          transformedData = data.data.map((row: any) => {
            // Create a normalized object using selected field names
            const normalizedRow: any = {};
            if (Array.isArray(selectedFields)) {
              selectedFields.forEach((fieldName: string) => {
                // Try to find the value using various field name variations
                normalizedRow[fieldName] = row[fieldName] ?? 
                                          row[fieldName.toLowerCase()] ?? 
                                          row[fieldName.toUpperCase()] ?? 
                                          (Array.isArray(keys) ? row[keys.find((k: string) => k.toLowerCase() === fieldName.toLowerCase()) || fieldName] : null) ??
                                          null;
              });
            }
            return normalizedRow;
          });
        }
      }

      console.log("Transformed Table Data:", {
        transformedLength: transformedData.length,
        firstTransformedRow: transformedData[0],
        keys,
      });

      setTableKeys(keys);
      setTableData(transformedData);
      setTableDataCount(data.count || transformedData.length);
      toast.success(`Ανακτήθηκαν ${(data.count || transformedData.length).toLocaleString("el-GR")} εγγραφές`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η ανάκτηση δεδομένων του πίνακα απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingTableData(false);
    }
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // When editing, we can use data from initialIntegration if not set
    const effectiveObject = selectedObject || (initialIntegration ? {
      name: initialIntegration.objectName,
      caption: initialIntegration.objectCaption || initialIntegration.objectName,
      type: "object",
    } : null);
    
    const effectiveTable = selectedTable || (initialIntegration ? {
      name: initialIntegration.tableName,
      caption: initialIntegration.tableCaption || initialIntegration.tableName,
      dbname: initialIntegration.tableDbname,
      type: "table",
    } : null);
    
    const effectiveSelectedFields = selectedFields.length > 0 
      ? selectedFields 
      : (initialIntegration?.configJson?.selectedFields || []);
    
    if (!effectiveObject || !effectiveTable || effectiveSelectedFields.length === 0) {
      toast.error("Ολοκληρώστε όλα τα απαιτούμενα βήματα");
      return;
    }

    if (!integrationName) {
      toast.error("Δώστε όνομα στην ενσωμάτωση");
      return;
    }

    if (!selectedModel || !uniqueIdentifierERP || !uniqueIdentifierModel) {
      toast.error("Ολοκληρώστε την αντιστοίχιση και τα μοναδικά πεδία");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const connectionId = authResult?.connectionId || initialConnectionId;
      
      // Validate tableDbname
      if (!effectiveTable.dbname) {
        throw new Error("Λείπει το όνομα του πίνακα στη βάση");
      }

      // Prepare request body
      const requestBody: any = {
        // Include integrationId if editing existing integration
        ...(initialIntegration?.id && { integrationId: initialIntegration.id }),
        name: integrationName,
        objectName: effectiveObject.name,
        objectCaption: effectiveObject.caption || null,
        tableName: effectiveTable.name,
        tableDbname: effectiveTable.dbname,
        tableCaption: effectiveTable.caption || null,
        config: {
            ...config,
            selectedFields: effectiveSelectedFields,
            fieldsString: effectiveSelectedFields.join(","),
            filter: "1=1", // Default filter, can be customized later
            tableDataCount: tableDataCount,
            // Mapping configuration - filter out "none" values
            modelMapping: {
              modelName: selectedModel,
              fieldMappings: Object.fromEntries(
                Object.entries(fieldMappings)
                  .filter(([key, value]) => key && key.toUpperCase() !== "MYDUMMY" && value && value !== "none")
              ),
              uniqueIdentifier: {
                erpField: uniqueIdentifierERP,
                modelField: uniqueIdentifierModel,
              },
              syncDirection: syncDirection,
            },
            // Schedule configuration
            schedule: (() => {
              // Normalize cron expression - remove spaces in */ patterns
              let cronExpr = getCronExpression().trim().replace(/\*\s*\/\s*/g, "*/");
              
              // Ensure cron expression has exactly 5 fields (minute hour day month day-of-week)
              const fields = cronExpr.split(/\s+/);
              if (fields.length === 4) {
                // Missing day-of-week field, add it (default to * for any day)
                cronExpr = `${cronExpr} *`;
              }
              
              let customCronExpr = scheduleType === "custom" ? customCron.trim().replace(/\*\s*\/\s*/g, "*/") : null;
              if (customCronExpr) {
                const customFields = customCronExpr.split(/\s+/);
                if (customFields.length === 4) {
                  customCronExpr = `${customCronExpr} *`;
                }
              }
              
              return {
                type: scheduleType,
                cronExpression: cronExpr,
                presetSchedule: scheduleType === "preset" ? presetSchedule : null,
                customCron: customCronExpr,
                scheduleTime: (presetSchedule === "daily" || presetSchedule === "weekly") ? scheduleTime : null,
                scheduleDay: presetSchedule === "weekly" ? scheduleDay : null,
              };
            })(),
          },
      };

      // If we have a connectionId, use it; otherwise, send connectionData to create one
      if (connectionId) {
        requestBody.connectionId = connectionId;
      } else {
        // Send connection data to create a connection automatically
        if (!authResult || !authData.registeredName || !authData.username || !authData.password || !authData.appId) {
          throw new Error("Λείπουν στοιχεία σύνδεσης. Κάντε ξανά ταυτοποίηση.");
        }

        requestBody.connectionData = {
          registeredName: authData.registeredName,
          username: authData.username,
          password: authData.password,
          appId: authData.appId,
          company: authResult.company || authData.company || "1001",
          branch: authResult.branch || authData.branch || "1000",
          module: authResult.module || authData.module || "0",
          refid: authResult.refid || authData.refid || "15",
          connectionName: authData.connectionName || `${authData.registeredName} - ${new Date().toLocaleDateString()}`,
        };
      }

      console.log("[WIZARD] Sending save request:", {
        hasConnectionId: !!requestBody.connectionId,
        hasConnectionData: !!requestBody.connectionData,
        name: requestBody.name,
        objectName: requestBody.objectName,
        tableName: requestBody.tableName,
        configKeys: Object.keys(requestBody.config || {}),
      });

      const response = await fetch("/api/softone/save-integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      console.log("[WIZARD] Save response:", data);

      if (!data.success) {
        const errorMsg = data.error || "Η αποθήκευση της ενσωμάτωσης απέτυχε";
        console.error("[WIZARD] Save failed:", errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success("Η ενσωμάτωση αποθηκεύτηκε");
      
      // Store the integration ID for potential import
      setSavedIntegrationId(data.integration.id);
      
      if (onCreated) {
        onCreated(data.integration);
      }
      
      // Don't close the dialog automatically - allow user to import if one-way sync
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η αποθήκευση της ενσωμάτωσης απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleImportNow = async () => {
    if (!savedIntegrationId) {
      toast.error("Δεν βρέθηκε η ενσωμάτωση. Αποθηκεύστε την πρώτα.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/cron/sync-integration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No cron secret needed - will use session authentication
        },
        body: JSON.stringify({
          integrationId: savedIntegrationId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        const errorMsg = data.error || "Η εισαγωγή δεδομένων απέτυχε";
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success(`Η εισαγωγή ολοκληρώθηκε: ${(data.stats?.created || 0).toLocaleString("el-GR")} νέες, ${(data.stats?.updated || 0).toLocaleString("el-GR")} ενημερωμένες.`);
      
      // Close the dialog after successful import
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Η εισαγωγή δεδομένων απέτυχε";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const getStepProgress = () => {
    switch (step) {
      case "AUTH":
        return 14;
      case "OBJECT":
        return 29;
      case "TABLE":
        return 43;
      case "FIELDS":
        return 57;
      case "MAPPING":
        return 71;
      case "SCHEDULE":
        return 86;
      case "SAVE":
        return 100;
      default:
        return 0;
    }
  };

  // Generate cron expression from schedule settings
  const getCronExpression = (): string => {
    if (scheduleType === "custom") {
      return customCron;
    }

    switch (presetSchedule) {
      case "every-1-min":
        return "*/1 * * * *";
      case "every-15-min":
        return "*/15 * * * *";
      case "every-30-min":
        return "*/30 * * * *";
      case "hourly":
        return "0 * * * *";
      case "every-6-hours":
        return "0 */6 * * *";
      case "every-12-hours":
        return "0 */12 * * *";
      case "daily": {
        const [hours, minutes] = scheduleTime.split(":");
        return `${minutes || "0"} ${hours || "9"} * * *`;
      }
      case "weekly": {
        const [hours, minutes] = scheduleTime.split(":");
        // day of week: 0-7 (0 and 7 are Sunday, 1 is Monday)
        return `${minutes || "0"} ${hours || "9"} * * ${scheduleDay}`;
      }
      default:
        return "0 * * * *"; // Default to hourly
    }
  };
  /** Τα βήματα του οδηγού, με τη σειρά που εμφανίζονται. */
  const STEPS: Array<{ id: Step; label: string }> = [
    { id: "AUTH", label: "Ταυτοποίηση" },
    { id: "OBJECT", label: "Αντικείμενο" },
    { id: "TABLE", label: "Πίνακας" },
    { id: "FIELDS", label: "Πεδία" },
    { id: "MAPPING", label: "Αντιστοίχιση" },
    { id: "SCHEDULE", label: "Προγραμματισμός" },
    { id: "SAVE", label: "Αποθήκευση" },
  ];

  const WEEKDAYS_EL = [
    "Κυριακή",
    "Δευτέρα",
    "Τρίτη",
    "Τετάρτη",
    "Πέμπτη",
    "Παρασκευή",
    "Σάββατο",
  ];

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const stepLabel = STEPS[stepIndex]?.label ?? "";

  const readableFrequency = (): string => {
    if (scheduleType === "custom") return `Προσαρμοσμένο: ${customCron}`;
    switch (presetSchedule) {
      case "every-1-min":
        return "Κάθε 1 λεπτό";
      case "every-15-min":
        return "Κάθε 15 λεπτά";
      case "every-30-min":
        return "Κάθε 30 λεπτά";
      case "hourly":
        return "Κάθε ώρα";
      case "every-6-hours":
        return "Κάθε 6 ώρες";
      case "every-12-hours":
        return "Κάθε 12 ώρες";
      case "daily":
        return `Καθημερινά στις ${scheduleTime}`;
      case "weekly":
        return `Κάθε ${WEEKDAYS_EL[parseInt(scheduleDay)] || "Δευτέρα"} στις ${scheduleTime}`;
      default:
        return presetSchedule;
    }
  };

  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Σφάλμα</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  const cleanSelectedFields = selectedFields.filter(
    (f) => f && f.trim() !== "" && f.toUpperCase() !== "MYDUMMY"
  );

  const renderStep = () => {
    switch (step) {
      case "AUTH":
        return (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Ταυτοποίηση</CardTitle>
              <CardDescription>
                Συμπληρώστε τα στοιχεία σύνδεσης με το SoftOne ERP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="registeredName">Επωνυμία εγκατάστασης *</Label>
                  <Input
                    id="registeredName"
                    value={authData.registeredName}
                    onChange={(e) => setAuthData({ ...authData, registeredName: e.target.value })}
                    placeholder="mycompany"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">Όνομα χρήστη *</Label>
                  <Input
                    id="username"
                    value={authData.username}
                    onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                    placeholder="Κωδικός Web Account"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Κωδικός πρόσβασης *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={authData.password}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                    placeholder="Κωδικός"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="appId" className="font-mono">APPID *</Label>
                    <Input
                      id="appId"
                      value={authData.appId}
                      onChange={(e) => setAuthData({ ...authData, appId: e.target.value })}
                      placeholder="1001"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company" className="font-mono">COMPANY</Label>
                    <Input
                      id="company"
                      value={authData.company}
                      onChange={(e) => setAuthData({ ...authData, company: e.target.value })}
                      placeholder="1002"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="saveConnection"
                      checked={authData.saveConnection}
                      onCheckedChange={(checked) =>
                        setAuthData({ ...authData, saveConnection: checked === true })
                      }
                    />
                    <Label htmlFor="saveConnection" className="cursor-pointer">
                      Αποθήκευση σύνδεσης για μελλοντική χρήση
                    </Label>
                  </div>
                  {authData.saveConnection && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="connectionName">Όνομα σύνδεσης *</Label>
                      <Input
                        id="connectionName"
                        value={authData.connectionName}
                        onChange={(e) => setAuthData({ ...authData, connectionName: e.target.value })}
                        placeholder="Η σύνδεσή μου στο SoftOne"
                        required={authData.saveConnection}
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>

                {errorAlert}

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        Ταυτοποίηση…
                      </>
                    ) : (
                      <>
                        Επόμενο
                        <ChevronRight />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        );

      case "OBJECT": {
        // Filter objects based on search query
        const filteredObjects = objects.filter((obj) => {
          if (!objectSearchQuery.trim()) return true;
          const query = objectSearchQuery.toLowerCase();
          return (
            obj.name.toLowerCase().includes(query) ||
            (obj.caption && obj.caption.toLowerCase().includes(query))
          );
        });

        return (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Επιλογή αντικειμένου</CardTitle>
              <CardDescription>
                Διαλέξτε ένα αντικείμενο EditMaster του SoftOne για την ενσωμάτωση.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="text"
                  placeholder="Αναζήτηση αντικειμένου με όνομα ή περιγραφή…"
                  value={objectSearchQuery}
                  onChange={(e) => setObjectSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {objects.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Εμφανίζονται {filteredObjects.length.toLocaleString("el-GR")} από{" "}
                  {objects.length.toLocaleString("el-GR")} αντικείμενα
                  {objectSearchQuery && ` για «${objectSearchQuery}»`}
                </div>
              )}

              {loadingObjects ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Spinner />
                  Φόρτωση αντικειμένων…
                </div>
              ) : filteredObjects.length === 0 ? (
                <EmptyState
                  title="Δεν βρέθηκαν αντικείμενα"
                  description={
                    objectSearchQuery
                      ? `Κανένα αντικείμενο δεν ταιριάζει με «${objectSearchQuery}».`
                      : "Το SoftOne δεν επέστρεψε αντικείμενα για αυτή τη σύνδεση."
                  }
                />
              ) : (
                <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                  {filteredObjects.map((obj, objIdx) => (
                    <button
                      type="button"
                      key={`${obj.name}-${objIdx}`}
                      onClick={() => handleObjectSelect(obj.name)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent/50",
                        selectedObject?.name === obj.name && "border-primary ring-1 ring-primary"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs font-semibold">{obj.name}</span>
                        {obj.caption && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {obj.caption}
                          </span>
                        )}
                      </span>
                      {selectedObject?.name === obj.name && (
                        <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {errorAlert}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("AUTH")}>
                  <ChevronLeft />
                  Πίσω
                </Button>
                <Button onClick={() => selectedObject && setStep("TABLE")} disabled={!selectedObject}>
                  Επόμενο
                  <ChevronRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      }

      case "TABLE":
        return (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Επιλογή πίνακα</CardTitle>
              <CardDescription>
                Διαλέξτε πίνακα από το αντικείμενο{" "}
                <span className="font-mono">{selectedObject?.name}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loadingTables ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Spinner />
                  Φόρτωση πινάκων…
                </div>
              ) : tables.length === 0 ? (
                <EmptyState
                  title="Δεν βρέθηκαν πίνακες"
                  description="Το επιλεγμένο αντικείμενο δεν επέστρεψε πίνακες."
                />
              ) : (
                <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                  {tables.map((table, tableIdx) => (
                    <button
                      type="button"
                      key={`${table.name}-${tableIdx}`}
                      onClick={() => handleTableSelect(table.name)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent/50",
                        selectedTable?.name === table.name && "border-primary ring-1 ring-primary"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs font-semibold">{table.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          Πίνακας βάσης: <span className="font-mono">{table.dbname}</span>
                        </span>
                        {table.caption && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {table.caption}
                          </span>
                        )}
                      </span>
                      {selectedTable?.name === table.name && (
                        <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {errorAlert}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("OBJECT")}>
                  <ChevronLeft />
                  Πίσω
                </Button>
                <Button onClick={() => selectedTable && setStep("FIELDS")} disabled={!selectedTable}>
                  Επόμενο
                  <ChevronRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case "FIELDS": {
        // Filter fields based on search query
        const filteredFields = fields.filter((field) => {
          if (!fieldSearchQuery.trim()) return true;
          const query = fieldSearchQuery.toLowerCase();
          return (
            field.name.toLowerCase().includes(query) ||
            (field.caption && field.caption.toLowerCase().includes(query))
          );
        });

        const isInstlinesTable =
          selectedTable?.name.toUpperCase() === "INSTLINES" ||
          !!selectedTable?.name.toUpperCase().includes("INSTLINES");

        return (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Επιλογή πεδίων</CardTitle>
              <CardDescription>
                Διαλέξτε πεδία από τον πίνακα <span className="font-mono">{selectedTable?.name}</span> (
                <span className="font-mono">{selectedTable?.dbname}</span>).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loadingFields ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Spinner />
                  Φόρτωση πεδίων…
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      type="text"
                      placeholder="Αναζήτηση πεδίου με όνομα ή περιγραφή…"
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  {fields.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Εμφανίζονται {filteredFields.length.toLocaleString("el-GR")} από{" "}
                          {fields.length.toLocaleString("el-GR")} πεδία
                          {fieldSearchQuery && ` για «${fieldSearchQuery}»`}
                        </span>
                        <span className="font-medium">
                          {selectedFields.length.toLocaleString("el-GR")} επιλεγμένα
                        </span>
                      </div>
                      {isInstlinesTable && (
                        <Alert>
                          <AlertCircle />
                          <AlertTitle>Απαιτούνται κρίσιμα πεδία</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc pl-4">
                              <li>
                                <span className="font-mono">INST</span> — σύνδεση με τον πίνακα INST
                                (υποχρεωτικό)
                              </li>
                              <li>
                                <span className="font-mono">INSTLINES</span> — πρωτεύον κλειδί του πίνακα
                                INSTLINES (υποχρεωτικό)
                              </li>
                            </ul>
                            {(!selectedFields.includes("INST") || !selectedFields.includes("INSTLINES")) && (
                              <span className="mt-1 block font-medium">
                                Βεβαιωθείτε ότι έχετε επιλέξει και τα δύο.
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {fields.length === 0 ? (
                    <EmptyState
                      title="Δεν βρέθηκαν πεδία"
                      description="Ο επιλεγμένος πίνακας δεν επέστρεψε πεδία."
                    />
                  ) : (
                    <div className="flex max-h-[250px] flex-col gap-2 overflow-y-auto">
                      {filteredFields.map((field, index) => {
                        // Highlight critical fields for INSTLINES table
                        const isCriticalField =
                          isInstlinesTable &&
                          (field.name.toUpperCase() === "INST" ||
                            field.name.toUpperCase() === "INSTLINES");
                        const isSelected = selectedFields.includes(field.name);

                        return (
                          <button
                            type="button"
                            key={`${field.name}-${index}`}
                            onClick={() => toggleFieldSelection(field.name)}
                            aria-pressed={isSelected}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent/50",
                              isSelected && "border-primary ring-1 ring-primary"
                            )}
                          >
                            {isSelected ? (
                              <CheckSquare className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                            ) : (
                              <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold">{field.name}</span>
                                {isCriticalField && <Badge variant="warning">Κρίσιμο</Badge>}
                                {field.required && !isCriticalField && (
                                  <Badge variant="neutral">Υποχρεωτικό</Badge>
                                )}
                                {field.readOnly && <Badge variant="outline">Μόνο ανάγνωση</Badge>}
                              </span>
                              {field.caption && (
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {field.caption}
                                </span>
                              )}
                              <span className="mt-1 block text-xs text-muted-foreground">
                                Τύπος: {field.type} {field.size != null && `(${field.size})`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={handleGetTableData}
                      disabled={selectedFields.length === 0 || loadingTableData}
                    >
                      {loadingTableData ? (
                        <>
                          <Spinner data-icon="inline-start" />
                          Φόρτωση δεδομένων…
                        </>
                      ) : (
                        <>
                          <Database />
                          Προεπισκόπηση δεδομένων
                        </>
                      )}
                    </Button>
                  </div>

                  {tableData.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold">Δείγμα δεδομένων</h4>
                        <Badge variant="neutral" className="tabular-nums">
                          {(tableDataCount ?? 0).toLocaleString("el-GR")} εγγραφές
                        </Badge>
                      </div>
                      <div className="max-h-[200px] overflow-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {cleanSelectedFields.map((fieldName, idx) => (
                                <TableHead key={`${fieldName}-${idx}`} className="font-mono">
                                  {fieldName}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tableData.slice(0, 10).map((row, idx) => (
                              <TableRow key={idx}>
                                {cleanSelectedFields.map((fieldName, fieldIdx) => {
                                  // Try multiple ways to access the value
                                  const value =
                                    row[fieldName] ??
                                    row[fieldName.toLowerCase()] ??
                                    row[fieldName.toUpperCase()] ??
                                    null;
                                  return (
                                    <TableCell key={`${fieldName}-${idx}-${fieldIdx}`}>
                                      {value !== null && value !== undefined ? String(value) : "—"}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {tableData.length > 10 && (
                        <div className="text-center text-xs text-muted-foreground">
                          Εμφανίζονται οι πρώτες 10 από {tableData.length.toLocaleString("el-GR")} εγγραφές
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {errorAlert}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("TABLE")}>
                  <ChevronLeft />
                  Πίσω
                </Button>
                <Button onClick={() => setStep("MAPPING")} disabled={selectedFields.length === 0}>
                  Επόμενο
                  <ChevronRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      }

      case "MAPPING":
        return (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Αντιστοίχιση πεδίων</CardTitle>
              <CardDescription>
                Αντιστοιχίστε τα πεδία του πίνακα SoftOne με τα πεδία του μοντέλου της εφαρμογής.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modelSelect">Μοντέλο προορισμού *</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel} disabled={loadingModels}>
                  <SelectTrigger id="modelSelect" className="w-full">
                    <SelectValue placeholder="Επιλογή μοντέλου…" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.displayName} — {model.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedModel && selectedFields.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">Αντιστοιχίσεις πεδίων</h4>
                  <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                    {selectedFields.map((softoneField, index) => {
                      const selectedModelObj = models.find((m) => m.name === selectedModel);
                      return (
                        <div
                          key={`${softoneField}-${index}`}
                          className="flex flex-col gap-1.5 rounded-md border bg-card p-3"
                        >
                          <span className="text-xs text-muted-foreground">
                            Πεδίο SoftOne:{" "}
                            <span className="font-mono font-medium text-foreground">{softoneField}</span>
                          </span>
                          <Select
                            value={fieldMappings[softoneField] || "none"}
                            onValueChange={(value) => {
                              setFieldMappings((prev) => {
                                const newMappings = { ...prev };
                                if (value === "none") {
                                  delete newMappings[softoneField];
                                } else {
                                  newMappings[softoneField] = value;
                                }
                                return newMappings;
                              });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Επιλογή πεδίου μοντέλου…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Χωρίς αντιστοίχιση</SelectItem>
                              {selectedModelObj?.fields.map((field, fieldIdx) => (
                                <SelectItem key={`${field.name}-${fieldIdx}`} value={field.name}>
                                  {field.name} ({field.type})
                                  {field.isId && " [ID]"}
                                  {field.isUnique && " [Μοναδικό]"}
                                  {field.isRequired && " [Υποχρεωτικό]"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {errorAlert}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("FIELDS")}>
                  <ChevronLeft />
                  Πίσω
                </Button>
                <Button
                  onClick={() => {
                    if (!selectedModel) {
                      setError("Επιλέξτε μοντέλο");
                      toast.error("Επιλέξτε μοντέλο");
                      return;
                    }
                    setStep("SCHEDULE");
                  }}
                  disabled={!selectedModel}
                >
                  Επόμενο
                  <ChevronRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case "SCHEDULE":
        return (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Προγραμματισμός συγχρονισμού</CardTitle>
              <CardDescription>
                Ορίστε πότε και κάθε πότε θα εκτελείται ο συγχρονισμός.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduleType">Τύπος προγραμματισμού *</Label>
                <Select
                  value={scheduleType}
                  onValueChange={(value: "preset" | "custom") => setScheduleType(value)}
                >
                  <SelectTrigger id="scheduleType" className="w-full">
                    <SelectValue placeholder="Επιλογή τύπου…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preset">Έτοιμος προγραμματισμός</SelectItem>
                    <SelectItem value="custom">Προσαρμοσμένη έκφραση cron</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scheduleType === "preset" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="presetSchedule">Συχνότητα *</Label>
                    <Select value={presetSchedule} onValueChange={setPresetSchedule}>
                      <SelectTrigger id="presetSchedule" className="w-full">
                        <SelectValue placeholder="Επιλογή συχνότητας…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="every-1-min">Κάθε 1 λεπτό</SelectItem>
                        <SelectItem value="every-15-min">Κάθε 15 λεπτά</SelectItem>
                        <SelectItem value="every-30-min">Κάθε 30 λεπτά</SelectItem>
                        <SelectItem value="hourly">Κάθε ώρα</SelectItem>
                        <SelectItem value="every-6-hours">Κάθε 6 ώρες</SelectItem>
                        <SelectItem value="every-12-hours">Κάθε 12 ώρες</SelectItem>
                        <SelectItem value="daily">Καθημερινά</SelectItem>
                        <SelectItem value="weekly">Εβδομαδιαία</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(presetSchedule === "daily" || presetSchedule === "weekly") && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="scheduleTime">Ώρα *</Label>
                      <Input
                        id="scheduleTime"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {presetSchedule === "weekly" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="scheduleDay">Ημέρα εβδομάδας *</Label>
                      <Select value={scheduleDay} onValueChange={setScheduleDay}>
                        <SelectTrigger id="scheduleDay" className="w-full">
                          <SelectValue placeholder="Επιλογή ημέρας…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Δευτέρα</SelectItem>
                          <SelectItem value="2">Τρίτη</SelectItem>
                          <SelectItem value="3">Τετάρτη</SelectItem>
                          <SelectItem value="4">Πέμπτη</SelectItem>
                          <SelectItem value="5">Παρασκευή</SelectItem>
                          <SelectItem value="6">Σάββατο</SelectItem>
                          <SelectItem value="0">Κυριακή</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {scheduleType === "custom" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="customCron">Έκφραση cron *</Label>
                  <p className="text-xs text-muted-foreground">
                    Μορφή: λεπτό ώρα ημέρα μήνας ημέρα-εβδομάδας (π.χ. «0 9 * * *» = καθημερινά στις 09:00).
                  </p>
                  <Input
                    id="customCron"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 * * * *"
                    className="font-mono"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="syncDirectionSchedule">Κατεύθυνση συγχρονισμού *</Label>
                <Select
                  value={syncDirection}
                  onValueChange={(value: "one-way" | "two-way") => setSyncDirection(value)}
                >
                  <SelectTrigger id="syncDirectionSchedule" className="w-full">
                    <SelectValue placeholder="Επιλογή κατεύθυνσης…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-way">Μονόδρομος (ERP → Εφαρμογή)</SelectItem>
                    <SelectItem value="two-way">Αμφίδρομος (ERP ↔ Εφαρμογή)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {syncDirection === "one-way"
                    ? "Τα δεδομένα έρχονται μόνο από το ERP προς την εφαρμογή. Η εφαρμογή δεν ενημερώνει τους πίνακες του ERP."
                    : "Τα δεδομένα ρέουν και προς τις δύο κατευθύνσεις: η εφαρμογή διαβάζει από το ERP και ενημερώνει τους πίνακές του όταν γίνονται αλλαγές."}
                </p>
              </div>

              <InfoPanel title="Έκφραση cron που θα χρησιμοποιηθεί" accent="bg-chart-3">
                <InfoRow label="Συχνότητα" wrap>
                  {readableFrequency()}
                </InfoRow>
                <InfoRow label="cron" mono wrap>
                  {getCronExpression()}
                </InfoRow>
              </InfoPanel>

              {errorAlert}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("MAPPING")}>
                  <ChevronLeft />
                  Πίσω
                </Button>
                <Button onClick={() => setStep("SAVE")}>
                  Επόμενο
                  <ChevronRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case "SAVE":
        return (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Αποθήκευση ενσωμάτωσης</CardTitle>
              <CardDescription>
                Ελέγξτε τη σύνοψη, δώστε όνομα και ορίστε τα μοναδικά πεδία ταύτισης.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveIntegration} className="flex flex-col gap-3">
                <InfoPanel title="Σύνοψη ρυθμίσεων">
                  <InfoRow label="Αντικείμενο" mono>
                    {selectedObject?.name ?? "—"}
                  </InfoRow>
                  <InfoRow label="Πίνακας" mono wrap>
                    {selectedTable ? `${selectedTable.name} (${selectedTable.dbname})` : "—"}
                  </InfoRow>
                  <InfoRow label="Πεδία" wrap>
                    {cleanSelectedFields.length.toLocaleString("el-GR")}
                    {cleanSelectedFields.length > 0 && ` — ${cleanSelectedFields.join(", ")}`}
                  </InfoRow>
                  {selectedModel && (
                    <InfoRow label="Μοντέλο προορισμού" wrap>
                      {models.find((m) => m.name === selectedModel)?.displayName || selectedModel}
                    </InfoRow>
                  )}
                  {uniqueIdentifierERP && uniqueIdentifierModel && (
                    <InfoRow label="Μοναδικά πεδία" mono wrap>
                      {uniqueIdentifierERP} → {uniqueIdentifierModel}
                    </InfoRow>
                  )}
                  <InfoRow label="Κατεύθυνση">
                    {syncDirection === "one-way"
                      ? "Μονόδρομος (ERP → Εφαρμογή)"
                      : "Αμφίδρομος (ERP ↔ Εφαρμογή)"}
                  </InfoRow>
                  {Object.keys(fieldMappings).filter((k) => k && k.toUpperCase() !== "MYDUMMY").length > 0 && (
                    <InfoRow label="Αντιστοιχίσεις πεδίων">
                      {Object.keys(fieldMappings)
                        .filter(
                          (k) =>
                            k &&
                            k.toUpperCase() !== "MYDUMMY" &&
                            fieldMappings[k] &&
                            fieldMappings[k] !== "none"
                        )
                        .length.toLocaleString("el-GR")}
                    </InfoRow>
                  )}
                  <InfoRow label="Πρόγραμμα" wrap>
                    {readableFrequency()}
                  </InfoRow>
                  <InfoRow label="cron" mono wrap>
                    {getCronExpression()}
                  </InfoRow>
                  {tableDataCount !== null && (
                    <InfoRow label="Εγγραφές στο ERP">
                      {tableDataCount.toLocaleString("el-GR")}
                    </InfoRow>
                  )}
                </InfoPanel>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="integrationName">Όνομα ενσωμάτωσης *</Label>
                  <Input
                    id="integrationName"
                    value={integrationName}
                    onChange={(e) => setIntegrationName(e.target.value)}
                    placeholder="π.χ. Πελάτες, Συμβόλαια"
                    required
                    disabled={loading}
                  />
                </div>

                {selectedModel && selectedFields.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground">
                        Μοναδικά πεδία ταύτισης
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Με αυτά τα πεδία ταυτίζονται οι εγγραφές του ERP με τις εγγραφές της εφαρμογής
                        κατά τον συγχρονισμό.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="uniqueIdentifierERP">Μοναδικό πεδίο SoftOne *</Label>
                      <Select
                        value={uniqueIdentifierERP}
                        onValueChange={setUniqueIdentifierERP}
                        disabled={loading}
                      >
                        <SelectTrigger id="uniqueIdentifierERP" className="w-full">
                          <SelectValue placeholder="Επιλογή πεδίου SoftOne…" />
                        </SelectTrigger>
                        <SelectContent>
                          {cleanSelectedFields.map((field, index) => (
                            <SelectItem key={`${field}-${index}`} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="uniqueIdentifierModel">Μοναδικό πεδίο μοντέλου *</Label>
                      <Select
                        value={uniqueIdentifierModel}
                        onValueChange={setUniqueIdentifierModel}
                        disabled={loading}
                      >
                        <SelectTrigger id="uniqueIdentifierModel" className="w-full">
                          <SelectValue placeholder="Επιλογή πεδίου μοντέλου…" />
                        </SelectTrigger>
                        <SelectContent>
                          {models
                            .find((m) => m.name === selectedModel)
                            ?.fields.map((field, fieldIdx) => (
                              <SelectItem key={`${field.name}-${fieldIdx}`} value={field.name}>
                                {field.name} ({field.type})
                                {field.isId && " [ID]"}
                                {field.isUnique && " [Μοναδικό]"}
                                {field.isRequired && " [Υποχρεωτικό]"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {uniqueIdentifierERP && uniqueIdentifierModel && (
                      <InfoPanel title="Ταύτιση εγγραφών" accent="bg-chart-2">
                        <InfoRow label="Πεδίο ERP" mono>
                          {uniqueIdentifierERP}
                        </InfoRow>
                        <InfoRow label="Πεδίο μοντέλου" mono>
                          {uniqueIdentifierModel}
                        </InfoRow>
                        <InfoRow label="Τι θα συμβεί" wrap>
                          {syncDirection === "one-way"
                            ? "Αν βρεθεί εγγραφή με την ίδια τιμή, ενημερώνεται· αλλιώς δημιουργείται νέα."
                            : "Οι εγγραφές ταυτίζονται με αυτά τα πεδία και οι αλλαγές ταξιδεύουν και προς τις δύο κατευθύνσεις."}
                        </InfoRow>
                      </InfoPanel>
                    )}
                  </div>
                )}

                {errorAlert}

                {savedIntegrationId && syncDirection === "one-way" && (
                  <Alert>
                    <AlertCircle />
                    <AlertTitle>Η ενσωμάτωση αποθηκεύτηκε</AlertTitle>
                    <AlertDescription className="flex flex-col items-start gap-2">
                      <span>Μπορείτε να κάνετε την πρώτη εισαγωγή δεδομένων από το ERP τώρα.</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleImportNow}
                        disabled={importing || loading}
                      >
                        {importing ? (
                          <>
                            <Spinner data-icon="inline-start" />
                            Εισαγωγή…
                          </>
                        ) : (
                          <>
                            <Download />
                            Εισαγωγή τώρα
                          </>
                        )}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (savedIntegrationId || initialIntegration?.id) {
                        // If already saved or editing, close the dialog
                        onOpenChange(false);
                      } else {
                        // Otherwise go back
                        setStep("SCHEDULE");
                      }
                    }}
                    disabled={loading || importing}
                  >
                    {savedIntegrationId || initialIntegration?.id ? (
                      "Κλείσιμο"
                    ) : (
                      <>
                        <ChevronLeft />
                        Πίσω
                      </>
                    )}
                  </Button>
                  {/* Αποθήκευση: σε νέα ενσωμάτωση ή όταν γίνεται επεξεργασία υπάρχουσας */}
                  {(!savedIntegrationId || initialIntegration?.id) && (
                    <Button
                      type="submit"
                      disabled={
                        loading || !integrationName || !uniqueIdentifierERP || !uniqueIdentifierModel
                      }
                    >
                      {loading ? (
                        <>
                          <Spinner data-icon="inline-start" />
                          Αποθήκευση…
                        </>
                      ) : (
                        <>
                          <Save />
                          {initialIntegration?.id ? "Αποθήκευση αλλαγών" : "Αποθήκευση ενσωμάτωσης"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-5 text-primary" aria-hidden />
            Οδηγός ενσωμάτωσης SoftOne
          </DialogTitle>
          <DialogDescription>
            Επτά βήματα: ταυτοποίηση, επιλογή αντικειμένου και πίνακα, πεδία, αντιστοίχιση,
            προγραμματισμός και αποθήκευση.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Badge variant="info" className="tabular-nums">
                  Βήμα {stepIndex + 1} από {STEPS.length}
                </Badge>
                <span className="truncate">{stepLabel}</span>
              </span>
              <span className="tabular-nums">{getStepProgress()}%</span>
            </div>
            <Progress value={getStepProgress()} className="h-1" />
          </div>

          <div ref={contentRef}>{renderStep()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
