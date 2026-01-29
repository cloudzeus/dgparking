"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, Database, Save, Search, CheckSquare, Square, Link2, Download, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formFieldStyles } from "@/lib/form-styles";
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
        setError(data.error || "Authentication failed");
        toast.error(data.error || "Authentication failed");
        return;
      }

      setAuthResult(data);
      toast.success("Authentication successful!");
      setStep("OBJECT");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
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
        setError(data.error || "Failed to load objects");
        toast.error(data.error || "Failed to load objects");
        return;
      }

      setObjects(data.objects || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load objects";
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
        setError(data.error || "Failed to load tables");
        toast.error(data.error || "Failed to load tables");
        return;
      }

      setTables(data.tables || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load tables";
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
        setError(data.error || "Failed to load fields");
        toast.error(data.error || "Failed to load fields");
        return;
      }

      setFields(data.fields || []);
      // All fields start unchecked - user must manually select
      setSelectedFields([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load fields";
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
        setError(data.error || "Failed to load models");
        toast.error(data.error || "Failed to load models");
        return;
      }

      setModels(data.models || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load models";
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
      toast.error("Please select at least one field");
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
        setError(data.error || "Failed to get table data");
        toast.error(data.error || "Failed to get table data");
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
      toast.success(`Retrieved ${data.count || transformedData.length} records`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get table data";
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
      toast.error("Please complete all required steps");
      return;
    }

    if (!integrationName) {
      toast.error("Please provide an integration name");
      return;
    }

    if (!selectedModel || !uniqueIdentifierERP || !uniqueIdentifierModel) {
      toast.error("Please complete the mapping and identifier configuration");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const connectionId = authResult?.connectionId || initialConnectionId;
      
      // Validate tableDbname
      if (!effectiveTable.dbname) {
        throw new Error("Table database name is missing");
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
          throw new Error("Connection information is missing. Please authenticate again.");
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
        const errorMsg = data.error || "Failed to save integration";
        console.error("[WIZARD] Save failed:", errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success("Integration saved successfully!");
      
      // Store the integration ID for potential import
      setSavedIntegrationId(data.integration.id);
      
      if (onCreated) {
        onCreated(data.integration);
      }
      
      // Don't close the dialog automatically - allow user to import if one-way sync
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save integration";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleImportNow = async () => {
    if (!savedIntegrationId) {
      toast.error("Integration ID not found. Please save the integration first.");
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
        const errorMsg = data.error || "Failed to import data";
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success(`Import completed! ${data.stats?.created || 0} created, ${data.stats?.updated || 0} updated.`);
      
      // Close the dialog after successful import
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import data";
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

  const renderStep = () => {
    switch (step) {
      case "AUTH":
        return (
          <form onSubmit={handleAuthSubmit} className={formFieldStyles.formSpacing}>
            <h3 className={formFieldStyles.sectionHeader}>AUTHENTICATION</h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              Enter your SoftOne ERP credentials to authenticate
            </p>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="registeredName" className={formFieldStyles.label}>
                REGISTERED NAME *
              </Label>
              <Input
                id="registeredName"
                value={authData.registeredName}
                onChange={(e) => setAuthData({ ...authData, registeredName: e.target.value })}
                placeholder="mycompany"
                required
                disabled={loading}
                className={formFieldStyles.input}
              />
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="username" className={formFieldStyles.label}>
                USERNAME *
              </Label>
              <Input
                id="username"
                value={authData.username}
                onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                placeholder="Web Accounts Code"
                required
                disabled={loading}
                className={formFieldStyles.input}
              />
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="password" className={formFieldStyles.label}>
                PASSWORD *
              </Label>
              <Input
                id="password"
                type="password"
                value={authData.password}
                onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                placeholder="Password"
                required
                disabled={loading}
                className={formFieldStyles.input}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="appId" className={formFieldStyles.label}>
                  APP ID *
                </Label>
                <Input
                  id="appId"
                  value={authData.appId}
                  onChange={(e) => setAuthData({ ...authData, appId: e.target.value })}
                  placeholder="1001"
                  required
                  disabled={loading}
                  className={formFieldStyles.input}
                />
              </div>
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="company" className={formFieldStyles.label}>
                  COMPANY
                </Label>
                <Input
                  id="company"
                  value={authData.company}
                  onChange={(e) => setAuthData({ ...authData, company: e.target.value })}
                  placeholder="1002"
                  disabled={loading}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="saveConnection"
                  checked={authData.saveConnection}
                  onChange={(e) => setAuthData({ ...authData, saveConnection: e.target.checked })}
                  className="h-3 w-3"
                />
                <Label htmlFor="saveConnection" className="text-[9px] cursor-pointer">
                  Save connection for future use
                </Label>
              </div>
              {authData.saveConnection && (
                <div className={formFieldStyles.fieldSpacing}>
                  <Label htmlFor="connectionName" className={formFieldStyles.label}>
                    CONNECTION NAME *
                  </Label>
                  <Input
                    id="connectionName"
                    value={authData.connectionName}
                    onChange={(e) => setAuthData({ ...authData, connectionName: e.target.value })}
                    placeholder="My SoftOne Connection"
                    required={authData.saveConnection}
                    disabled={loading}
                    className={formFieldStyles.input}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="text-[9px] text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading} className={formFieldStyles.button}>
                {loading ? (
                  <>
                    <Loader2 className={formFieldStyles.buttonIcon} />
                    AUTHENTICATING...
                  </>
                ) : (
                  <>
                    NEXT
                    <ChevronRight className={formFieldStyles.buttonIcon} />
                  </>
                )}
              </Button>
            </div>
          </form>
        );

      case "OBJECT":
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
          <div className={formFieldStyles.formSpacing}>
            <h3 className={formFieldStyles.sectionHeader}>SELECT OBJECT</h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              Choose a SoftOne EditMaster object to integrate
            </p>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search objects by name or caption..."
                value={objectSearchQuery}
                onChange={(e) => setObjectSearchQuery(e.target.value)}
                className={`${formFieldStyles.input} pl-7`}
              />
            </div>

            {/* Results count */}
            {objects.length > 0 && (
              <div className="text-[9px] text-muted-foreground mb-2">
                Showing {filteredObjects.length} of {objects.length} objects
                {objectSearchQuery && ` matching "${objectSearchQuery}"`}
              </div>
            )}

            {loadingObjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredObjects.length === 0 ? (
              <div className="text-[9px] text-muted-foreground text-center py-8">
                {objectSearchQuery
                  ? `No objects found matching "${objectSearchQuery}"`
                  : "No objects found"}
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {filteredObjects.map((obj, objIdx) => (
                  <Card
                    key={`${obj.name}-${objIdx}`}
                    className={`cursor-pointer transition-colors ${
                      selectedObject?.name === obj.name
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handleObjectSelect(obj.name)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-semibold">{obj.name}</div>
                          {obj.caption && (
                            <div className="text-[9px] text-muted-foreground mt-1">
                              {obj.caption}
                            </div>
                          )}
                        </div>
                        {selectedObject?.name === obj.name && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {error && (
              <div className="text-[9px] text-destructive bg-destructive/10 p-2 rounded mt-3">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("AUTH")}
                className={formFieldStyles.button}
              >
                <ChevronLeft className={formFieldStyles.buttonIcon} />
                BACK
              </Button>
              <Button
                onClick={() => selectedObject && setStep("TABLE")}
                disabled={!selectedObject}
                className={formFieldStyles.button}
              >
                NEXT
                <ChevronRight className={formFieldStyles.buttonIcon} />
              </Button>
            </div>
          </div>
        );

      case "TABLE":
        return (
          <div className={formFieldStyles.formSpacing}>
            <h3 className={formFieldStyles.sectionHeader}>SELECT TABLE</h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              Choose a table from the {selectedObject?.name} object
            </p>

            {loadingTables ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : tables.length === 0 ? (
              <div className="text-[9px] text-muted-foreground text-center py-8">
                No tables found
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {tables.map((table, tableIdx) => (
                  <Card
                    key={`${table.name}-${tableIdx}`}
                    className={`cursor-pointer transition-colors ${
                      selectedTable?.name === table.name
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handleTableSelect(table.name)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-semibold">{table.name}</div>
                          <div className="text-[9px] text-muted-foreground mt-1">
                            DB: {table.dbname}
                          </div>
                          {table.caption && (
                            <div className="text-[9px] text-muted-foreground mt-1">
                              {table.caption}
                            </div>
                          )}
                        </div>
                        {selectedTable?.name === table.name && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {error && (
              <div className="text-[9px] text-destructive bg-destructive/10 p-2 rounded mt-3">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("OBJECT")}
                className={formFieldStyles.button}
              >
                <ChevronLeft className={formFieldStyles.buttonIcon} />
                BACK
              </Button>
              <Button
                onClick={() => selectedTable && setStep("FIELDS")}
                disabled={!selectedTable}
                className={formFieldStyles.button}
              >
                NEXT
                <ChevronRight className={formFieldStyles.buttonIcon} />
              </Button>
            </div>
          </div>
        );

      case "FIELDS":
        // Filter fields based on search query
        const filteredFields = fields.filter((field) => {
          if (!fieldSearchQuery.trim()) return true;
          const query = fieldSearchQuery.toLowerCase();
          return (
            field.name.toLowerCase().includes(query) ||
            (field.caption && field.caption.toLowerCase().includes(query))
          );
        });

        return (
          <div className={formFieldStyles.formSpacing}>
            <h3 className={formFieldStyles.sectionHeader}>SELECT FIELDS</h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              Choose fields from {selectedTable?.name} table ({selectedTable?.dbname})
            </p>

            {loadingFields ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Search Input */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search fields by name or caption..."
                    value={fieldSearchQuery}
                    onChange={(e) => setFieldSearchQuery(e.target.value)}
                    className={`${formFieldStyles.input} pl-7`}
                  />
                </div>

                {/* Results count and selection info */}
                {fields.length > 0 && (
                  <div className="space-y-2 mb-2">
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>
                        Showing {filteredFields.length} of {fields.length} fields
                        {fieldSearchQuery && ` matching "${fieldSearchQuery}"`}
                      </span>
                      <span className="font-medium">
                        {selectedFields.length} selected
                      </span>
                    </div>
                    {/* Warning for INSTLINES table - critical fields */}
                    {(selectedTable?.name.toUpperCase() === "INSTLINES" || 
                      selectedTable?.name.toUpperCase().includes("INSTLINES")) && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2 text-[9px]">
                        <div className="font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                          ⚠️ CRITICAL FIELDS REQUIRED:
                        </div>
                        <div className="space-y-0.5 text-yellow-600 dark:text-yellow-500">
                          <div>• <strong>INST</strong> - Foreign key linking to INST table (REQUIRED)</div>
                          <div>• <strong>INSTLINES</strong> - Primary key of INSTLINES table (REQUIRED)</div>
                        </div>
                        {(!selectedFields.includes("INST") || !selectedFields.includes("INSTLINES")) && (
                          <div className="mt-1 text-yellow-700 dark:text-yellow-400 font-medium">
                            Please ensure both INST and INSTLINES are selected!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Field Selection */}
                {fields.length === 0 ? (
                  <div className="text-[9px] text-muted-foreground text-center py-8">
                    No fields found
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto mb-3">
                    {filteredFields.map((field, index) => {
                      // Highlight critical fields for INSTLINES table
                      const isCriticalField = 
                        (selectedTable?.name.toUpperCase() === "INSTLINES" || 
                         selectedTable?.name.toUpperCase().includes("INSTLINES")) &&
                        (field.name.toUpperCase() === "INST" || field.name.toUpperCase() === "INSTLINES");
                      
                      return (
                      <Card
                        key={`${field.name}-${index}`}
                        className={`cursor-pointer transition-colors ${
                          selectedFields.includes(field.name)
                            ? "border-primary bg-primary/5"
                            : isCriticalField
                            ? "border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleFieldSelection(field.name)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">
                              {selectedFields.includes(field.name) ? (
                                <CheckSquare className="h-3 w-3 text-primary" />
                              ) : (
                                <Square className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`text-[10px] font-semibold ${isCriticalField ? "text-yellow-700 dark:text-yellow-400" : ""}`}>
                                  {field.name}
                                  {isCriticalField && " ⚠️"}
                                </div>
                                {isCriticalField && (
                                  <Badge variant="default" className="text-[8px] px-1 bg-yellow-500 text-yellow-900">
                                    CRITICAL
                                  </Badge>
                                )}
                                {field.required && !isCriticalField && (
                                  <Badge variant="secondary" className="text-[8px] px-1">
                                    Required
                                  </Badge>
                                )}
                                {field.readOnly && (
                                  <Badge variant="outline" className="text-[8px] px-1">
                                    Read-only
                                  </Badge>
                                )}
                              </div>
                              {field.caption && (
                                <div className="text-[9px] text-muted-foreground mt-1">
                                  {field.caption}
                                </div>
                              )}
                              <div className="text-[8px] text-muted-foreground mt-1">
                                Type: {field.type} {field.size != null && `(${field.size})`}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}

                {/* Get Table Data Button */}
                <div className="flex justify-end mb-3">
                  <Button
                    onClick={handleGetTableData}
                    disabled={selectedFields.length === 0 || loadingTableData}
                    className={formFieldStyles.button}
                  >
                    {loadingTableData ? (
                      <>
                        <Loader2 className={formFieldStyles.buttonIcon} />
                        LOADING DATA...
                      </>
                    ) : (
                      <>
                        <Database className={formFieldStyles.buttonIcon} />
                        GET TABLE DATA
                      </>
                    )}
                  </Button>
                </div>

                {/* Table Data Results */}
                {tableData.length > 0 && (
                  <div className="border rounded-md p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-semibold">TABLE DATA RESULTS</h4>
                      <Badge variant="secondary" className="text-[8px]">
                        {tableDataCount} records
                      </Badge>
                    </div>
                    <div className="max-h-[200px] overflow-auto">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[9px]">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              {selectedFields
                                .filter((fieldName) => fieldName && fieldName.toUpperCase() !== "MYDUMMY") // Remove MYDUMMY and empty fields
                                .map((fieldName, idx) => (
                                  <th key={`${fieldName}-${idx}`} className="px-2 py-1 text-left font-semibold border-b">
                                    {fieldName}
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.slice(0, 10).map((row, idx) => (
                              <tr key={idx} className="border-b">
                                {selectedFields
                                  .filter((fieldName) => fieldName && fieldName.toUpperCase() !== "MYDUMMY") // Remove MYDUMMY and empty fields
                                  .map((fieldName, fieldIdx) => {
                                    // Try multiple ways to access the value
                                    const value = row[fieldName] ?? row[fieldName.toLowerCase()] ?? row[fieldName.toUpperCase()] ?? null;
                                    return (
                                      <td key={`${fieldName}-${idx}-${fieldIdx}`} className="px-2 py-1">
                                        {value !== null && value !== undefined ? String(value) : "-"}
                                      </td>
                                    );
                                  })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {tableData.length > 10 && (
                          <div className="text-[8px] text-muted-foreground text-center mt-2">
                            Showing first 10 of {tableData.length} records
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="text-[9px] text-destructive bg-destructive/10 p-2 rounded mt-3">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("TABLE")}
                className={formFieldStyles.button}
              >
                <ChevronLeft className={formFieldStyles.buttonIcon} />
                BACK
              </Button>
              <Button
                onClick={() => setStep("MAPPING")}
                disabled={selectedFields.length === 0}
                className={formFieldStyles.button}
              >
                NEXT
                <ChevronRight className={formFieldStyles.buttonIcon} />
              </Button>
            </div>
          </div>
        );

      case "MAPPING":
        return (
          <div className={formFieldStyles.formSpacing}>
            <h3 className={formFieldStyles.sectionHeader}>FIELD MAPPING</h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              Map SoftOne table fields to your database model fields and define the unique identifier
            </p>

            {/* Model Selection */}
            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="modelSelect" className={formFieldStyles.label}>
                SELECT MODEL *
              </Label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={loadingModels}
              >
                <SelectTrigger className={formFieldStyles.select}>
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.name} value={model.name} className={formFieldStyles.selectItem}>
                      {model.displayName} - {model.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field Mappings */}
            {selectedModel && selectedFields.length > 0 && (
              <div className="space-y-3 mt-4">
                <h4 className="text-[10px] font-semibold text-muted-foreground">FIELD MAPPINGS</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedFields.map((softoneField, index) => {
                    const selectedModelObj = models.find((m) => m.name === selectedModel);
                    return (
                      <Card key={`${softoneField}-${index}`} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-[9px] font-medium mb-1">
                              SoftOne: <span className="text-primary">{softoneField}</span>
                            </div>
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
                              <SelectTrigger className={formFieldStyles.select}>
                                <SelectValue placeholder="Select model field..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className={formFieldStyles.selectItem}>
                                  -- No mapping --
                                </SelectItem>
                                {selectedModelObj?.fields.map((field, fieldIdx) => (
                                  <SelectItem
                                    key={`${field.name}-${fieldIdx}`}
                                    value={field.name}
                                    className={formFieldStyles.selectItem}
                                  >
                                    {field.name} ({field.type})
                                    {field.isId && " [ID]"}
                                    {field.isUnique && " [Unique]"}
                                    {field.isRequired && " [Required]"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}


            {error && (
              <div className="text-[9px] text-destructive bg-destructive/10 p-2 rounded mt-3">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("FIELDS")}
                className={formFieldStyles.button}
              >
                <ChevronLeft className={formFieldStyles.buttonIcon} />
                BACK
              </Button>
              <Button
                onClick={() => {
                  if (!selectedModel) {
                    setError("Please select a model");
                    toast.error("Please select a model");
                    return;
                  }
                  setStep("SCHEDULE");
                }}
                disabled={!selectedModel}
                className={formFieldStyles.button}
              >
                NEXT
                <ChevronRight className={formFieldStyles.buttonIcon} />
              </Button>
            </div>
          </div>
        );

      case "SCHEDULE":
        return (
          <div className={formFieldStyles.formSpacing}>
            <h3 className={formFieldStyles.sectionHeader}>SYNC SCHEDULE</h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              Configure when and how often the integration will sync data
            </p>

            {/* Schedule Type Selection */}
            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="scheduleType" className={formFieldStyles.label}>
                SCHEDULE TYPE *
              </Label>
              <Select
                value={scheduleType}
                onValueChange={(value: "preset" | "custom") => setScheduleType(value)}
              >
                <SelectTrigger className={formFieldStyles.select}>
                  <SelectValue placeholder="Select schedule type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset" className={formFieldStyles.selectItem}>
                    Preset Schedule
                  </SelectItem>
                  <SelectItem value="custom" className={formFieldStyles.selectItem}>
                    Custom Cron Expression
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preset Schedule Options */}
            {scheduleType === "preset" && (
              <>
                <div className={formFieldStyles.fieldSpacing}>
                  <Label htmlFor="presetSchedule" className={formFieldStyles.label}>
                    FREQUENCY *
                  </Label>
                  <Select
                    value={presetSchedule}
                    onValueChange={setPresetSchedule}
                  >
                    <SelectTrigger className={formFieldStyles.select}>
                      <SelectValue placeholder="Select frequency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="every-1-min" className={formFieldStyles.selectItem}>
                        Every 1 minute
                      </SelectItem>
                      <SelectItem value="every-15-min" className={formFieldStyles.selectItem}>
                        Every 15 minutes
                      </SelectItem>
                      <SelectItem value="every-30-min" className={formFieldStyles.selectItem}>
                        Every 30 minutes
                      </SelectItem>
                      <SelectItem value="hourly" className={formFieldStyles.selectItem}>
                        Every hour
                      </SelectItem>
                      <SelectItem value="every-6-hours" className={formFieldStyles.selectItem}>
                        Every 6 hours
                      </SelectItem>
                      <SelectItem value="every-12-hours" className={formFieldStyles.selectItem}>
                        Every 12 hours
                      </SelectItem>
                      <SelectItem value="daily" className={formFieldStyles.selectItem}>
                        Daily
                      </SelectItem>
                      <SelectItem value="weekly" className={formFieldStyles.selectItem}>
                        Weekly
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Time selection for daily/weekly */}
                {(presetSchedule === "daily" || presetSchedule === "weekly") && (
                  <div className={formFieldStyles.fieldSpacing}>
                    <Label htmlFor="scheduleTime" className={formFieldStyles.label}>
                      TIME *
                    </Label>
                    <Input
                      id="scheduleTime"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className={formFieldStyles.input}
                      required
                    />
                  </div>
                )}

                {/* Day selection for weekly */}
                {presetSchedule === "weekly" && (
                  <div className={formFieldStyles.fieldSpacing}>
                    <Label htmlFor="scheduleDay" className={formFieldStyles.label}>
                      DAY OF WEEK *
                    </Label>
                    <Select
                      value={scheduleDay}
                      onValueChange={setScheduleDay}
                    >
                      <SelectTrigger className={formFieldStyles.select}>
                        <SelectValue placeholder="Select day..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className={formFieldStyles.selectItem}>Monday</SelectItem>
                        <SelectItem value="2" className={formFieldStyles.selectItem}>Tuesday</SelectItem>
                        <SelectItem value="3" className={formFieldStyles.selectItem}>Wednesday</SelectItem>
                        <SelectItem value="4" className={formFieldStyles.selectItem}>Thursday</SelectItem>
                        <SelectItem value="5" className={formFieldStyles.selectItem}>Friday</SelectItem>
                        <SelectItem value="6" className={formFieldStyles.selectItem}>Saturday</SelectItem>
                        <SelectItem value="0" className={formFieldStyles.selectItem}>Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* Custom Cron Expression */}
            {scheduleType === "custom" && (
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="customCron" className={formFieldStyles.label}>
                  CRON EXPRESSION *
                </Label>
                <p className="text-[8px] text-muted-foreground mb-2">
                  Format: minute hour day month dayOfWeek (e.g., "0 9 * * *" = Daily at 9 AM)
                </p>
                <Input
                  id="customCron"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="0 * * * *"
                  className={formFieldStyles.input}
                  required
                />
              </div>
            )}

            {/* Sync Direction (can be changed here) */}
            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="syncDirectionSchedule" className={formFieldStyles.label}>
                SYNC DIRECTION *
              </Label>
              <Select
                value={syncDirection}
                onValueChange={(value: "one-way" | "two-way") => setSyncDirection(value)}
              >
                <SelectTrigger className={formFieldStyles.select}>
                  <SelectValue placeholder="Select sync direction..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-way" className={formFieldStyles.selectItem}>
                    One-way (ERP → App)
                  </SelectItem>
                  <SelectItem value="two-way" className={formFieldStyles.selectItem}>
                    Two-way (ERP ↔ App)
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 space-y-1">
                {syncDirection === "one-way" ? (
                  <div className="text-[8px] text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                    <strong>One-way sync:</strong> Data flows only from ERP to your application. Your app will update its database from ERP, but cannot update ERP tables.
                  </div>
                ) : (
                  <div className="text-[8px] text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded">
                    <strong>Two-way sync:</strong> Data flows both ways. Your app can read from ERP and also update ERP tables when changes are made in your application.
                  </div>
                )}
              </div>
            </div>

            {/* Cron Expression Preview */}
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="text-[9px] text-muted-foreground">
                <div className="font-medium mb-1">Generated Cron Expression:</div>
                <code className="text-[10px] font-mono bg-background px-2 py-1 rounded">
                  {getCronExpression()}
                </code>
              </div>
            </div>

            {error && (
              <div className="text-[9px] text-destructive bg-destructive/10 p-2 rounded mt-3">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep("MAPPING")}
                className={formFieldStyles.button}
              >
                <ChevronLeft className={formFieldStyles.buttonIcon} />
                BACK
              </Button>
              <Button
                onClick={() => setStep("SAVE")}
                className={formFieldStyles.button}
              >
                NEXT
                <ChevronRight className={formFieldStyles.buttonIcon} />
              </Button>
            </div>
          </div>
        );

      case "SAVE":
        return (
          <form onSubmit={handleSaveIntegration} className={formFieldStyles.formSpacing}>
            <h3 className={formFieldStyles.sectionHeader}>SAVE INTEGRATION</h3>
            <p className="text-[9px] text-muted-foreground mb-3">
              Provide a name for this integration
            </p>

            <div className="bg-muted/50 p-3 rounded-md mb-3">
              <div className="text-[9px] text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">Object:</span> {selectedObject?.name}
                </div>
                <div>
                  <span className="font-medium">Table:</span> {selectedTable?.name} ({selectedTable?.dbname})
                </div>
                <div>
                  <span className="font-medium">Fields:</span> {selectedFields.filter((f) => f && f.trim() !== "" && f.toUpperCase() !== "MYDUMMY").length} selected
                  {selectedFields.filter((f) => f && f.trim() !== "" && f.toUpperCase() !== "MYDUMMY").length > 0 && 
                    ` (${selectedFields.filter((f) => f && f.trim() !== "" && f.toUpperCase() !== "MYDUMMY").join(", ")})`}
                </div>
                {selectedModel && (
                  <div>
                    <span className="font-medium">Target Model:</span> {models.find((m) => m.name === selectedModel)?.displayName || selectedModel}
                  </div>
                )}
                {uniqueIdentifierERP && uniqueIdentifierModel && (
                  <div>
                    <span className="font-medium">Unique Identifiers:</span> ERP: <code className="text-[8px]">{uniqueIdentifierERP}</code> → Model: <code className="text-[8px]">{uniqueIdentifierModel}</code>
                  </div>
                )}
                {syncDirection && (
                  <div>
                    <span className="font-medium">Sync Direction:</span>{" "}
                    {syncDirection === "one-way" ? "One-way (ERP → App)" : "Two-way (ERP ↔ App)"}
                  </div>
                )}
                {Object.keys(fieldMappings).filter((k) => k && k.toUpperCase() !== "MYDUMMY").length > 0 && (
                  <div>
                    <span className="font-medium">Field Mappings:</span> {Object.keys(fieldMappings).filter((k) => k && k.toUpperCase() !== "MYDUMMY" && fieldMappings[k] && fieldMappings[k] !== "none").length} configured
                  </div>
                )}
                <div>
                  <span className="font-medium">Schedule:</span>{" "}
                  {scheduleType === "preset" 
                    ? presetSchedule === "every-1-min" ? "Every 1 minute"
                    : presetSchedule === "hourly" ? "Every hour"
                    : presetSchedule === "every-15-min" ? "Every 15 minutes"
                    : presetSchedule === "every-30-min" ? "Every 30 minutes"
                    : presetSchedule === "every-6-hours" ? "Every 6 hours"
                    : presetSchedule === "every-12-hours" ? "Every 12 hours"
                    : presetSchedule === "daily" ? `Daily at ${scheduleTime}`
                    : presetSchedule === "weekly" ? `Weekly on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parseInt(scheduleDay)]} at ${scheduleTime}`
                    : presetSchedule
                    : `Custom: ${customCron}`}
                </div>
                <div>
                  <span className="font-medium">Cron Expression:</span>{" "}
                  <code className="text-[8px] font-mono">{getCronExpression()}</code>
                </div>
                {tableDataCount !== null && (
                  <div>
                    <span className="font-medium">Data Records:</span> {tableDataCount}
                  </div>
                )}
              </div>
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="integrationName" className={formFieldStyles.label}>
                INTEGRATION NAME *
              </Label>
              <Input
                id="integrationName"
                value={integrationName}
                onChange={(e) => setIntegrationName(e.target.value)}
                placeholder="e.g., Customers Main, Sales Headers"
                required
                disabled={loading}
                className={formFieldStyles.input}
              />
            </div>

            {/* Unique Identifier Mapping */}
            {selectedModel && selectedFields.length > 0 && (
              <div className="space-y-3 mt-4">
                <h4 className="text-[10px] font-semibold text-muted-foreground">UNIQUE IDENTIFIER MAPPING</h4>
                <p className="text-[8px] text-muted-foreground">
                  Define the unique identifier fields from both ERP and your model. These fields will be used to match records during sync.
                </p>
                
                <div className={formFieldStyles.fieldSpacing}>
                  <Label htmlFor="uniqueIdentifierERP" className={formFieldStyles.label}>
                    ERP/SOFTONE IDENTIFIER FIELD *
                  </Label>
                  <p className="text-[8px] text-muted-foreground mb-2">
                    Select the SoftOne field that uniquely identifies each record
                  </p>
                  <Select
                    value={uniqueIdentifierERP}
                    onValueChange={setUniqueIdentifierERP}
                    disabled={loading}
                  >
                    <SelectTrigger className={formFieldStyles.select}>
                      <SelectValue placeholder="Select ERP identifier field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedFields
                        .filter((fieldName) => fieldName && fieldName.toUpperCase() !== "MYDUMMY") // Remove MYDUMMY and empty fields
                        .map((field, index) => (
                          <SelectItem key={`${field}-${index}`} value={field} className={formFieldStyles.selectItem}>
                            {field}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className={formFieldStyles.fieldSpacing}>
                  <Label htmlFor="uniqueIdentifierModel" className={formFieldStyles.label}>
                    MODEL IDENTIFIER FIELD *
                  </Label>
                  <p className="text-[8px] text-muted-foreground mb-2">
                    Select the corresponding field in your model that uniquely identifies each record
                  </p>
                  <Select
                    value={uniqueIdentifierModel}
                    onValueChange={setUniqueIdentifierModel}
                    disabled={loading}
                  >
                    <SelectTrigger className={formFieldStyles.select}>
                      <SelectValue placeholder="Select model identifier field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {models.find((m) => m.name === selectedModel)?.fields.map((field, fieldIdx) => (
                        <SelectItem
                          key={`${field.name}-${fieldIdx}`}
                          value={field.name}
                          className={formFieldStyles.selectItem}
                        >
                          {field.name} ({field.type})
                          {field.isId && " [ID]"}
                          {field.isUnique && " [Unique]"}
                          {field.isRequired && " [Required]"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {uniqueIdentifierERP && uniqueIdentifierModel && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <div className="text-[9px] text-muted-foreground">
                      <div className="font-medium mb-1">Identifier Mapping:</div>
                      <div className="space-y-1">
                        <div>
                          <span className="font-semibold">ERP Field:</span> <code className="text-[8px] font-mono">{uniqueIdentifierERP}</code>
                        </div>
                        <div>
                          <span className="font-semibold">Model Field:</span> <code className="text-[8px] font-mono">{uniqueIdentifierModel}</code>
                        </div>
                        <div className="text-[8px] mt-2 pt-2 border-t">
                          {syncDirection === "one-way" ? (
                            <>During sync, records will be matched by comparing <code>{uniqueIdentifierERP}</code> (ERP) with <code>{uniqueIdentifierModel}</code> (Model). If a match is found, the record will be updated; otherwise, a new record will be created.</>
                          ) : (
                            <>During two-way sync, records will be matched using these identifier fields. Updates can flow in both directions based on the identifier match.</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-[9px] text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}

            {/* Show import button for one-way sync after saving */}
            {savedIntegrationId && syncDirection === "one-way" && (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="text-[9px] text-muted-foreground mb-2">
                  <strong>Integration saved!</strong> You can now import data from ERP for the first time.
                </div>
                <Button
                  type="button"
                  onClick={handleImportNow}
                  disabled={importing || loading}
                  className={`${formFieldStyles.button} bg-blue-600 hover:bg-blue-700 text-white`}
                >
                  {importing ? (
                    <>
                      <Loader2 className={formFieldStyles.buttonIcon} />
                      IMPORTING...
                    </>
                  ) : (
                    <>
                      <Download className={formFieldStyles.buttonIcon} />
                      IMPORT NOW
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="flex justify-between pt-4">
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
                className={formFieldStyles.button}
              >
                {(savedIntegrationId || initialIntegration?.id) ? (
                  "CLOSE"
                ) : (
                  <>
                    <ChevronLeft className={formFieldStyles.buttonIcon} />
                    BACK
                  </>
                )}
              </Button>
              {/* Show save button if: creating new integration OR editing existing integration (even if already saved once) */}
              {(!savedIntegrationId || initialIntegration?.id) && (
                <Button 
                  type="submit" 
                  disabled={loading || !integrationName || !uniqueIdentifierERP || !uniqueIdentifierModel} 
                  className={formFieldStyles.button}
                >
                  {loading ? (
                    <>
                      <Loader2 className={formFieldStyles.buttonIcon} />
                      {initialIntegration?.id ? "SAVING CHANGES..." : "SAVING..."}
                    </>
                  ) : (
                    <>
                      <Save className={formFieldStyles.buttonIcon} />
                      {initialIntegration?.id ? "SAVE CHANGES" : "SAVE INTEGRATION"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            SoftOne Integration Wizard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>
                Step{" "}
                {step === "AUTH"
                  ? "1"
                  : step === "OBJECT"
                  ? "2"
                  : step === "TABLE"
                  ? "3"
                  : step === "FIELDS"
                  ? "4"
                  : step === "MAPPING"
                  ? "5"
                  : step === "SCHEDULE"
                  ? "6"
                  : "7"}{" "}
                of 7
              </span>
              <span>{getStepProgress()}%</span>
            </div>
            <Progress value={getStepProgress()} className="h-1" />
          </div>

          <div ref={contentRef}>{renderStep()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
