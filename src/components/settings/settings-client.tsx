"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formFieldStyles } from "@/lib/form-styles";
import { Loader2, Save, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export type WorkingHoursRow = {
  dayOfWeek: number;
  label: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

interface SettingsClientProps {
  initialWorkingHours: WorkingHoursRow[];
}

export function SettingsClient({ initialWorkingHours }: SettingsClientProps) {
  const [workingHours, setWorkingHours] =
    useState<WorkingHoursRow[]>(initialWorkingHours);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWorkingHours(initialWorkingHours);
  }, [initialWorkingHours]);

  const loadWorkingHours = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/working-hours");
      const data = await res.json();
      if (data.success && data.workingHours) {
        setWorkingHours(data.workingHours);
      }
    } catch (e) {
      toast.error("Failed to load working hours");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingHours: workingHours.map((row) => ({
            dayOfWeek: row.dayOfWeek,
            openTime: row.isClosed ? null : row.openTime,
            closeTime: row.isClosed ? null : row.closeTime,
            isClosed: row.isClosed,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Working hours saved");
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch (e) {
      toast.error("Failed to save working hours");
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (dayOfWeek: number, patch: Partial<WorkingHoursRow>) => {
    setWorkingHours((prev) =>
      prev.map((row) =>
        row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row
      )
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="SETTINGS"
        subtitle="Parking working hours per weekday for managing cars and pricing"
      />

      <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            PARKING WORKING HOURS
          </CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadWorkingHours}
              disabled={loading}
              className={formFieldStyles.button}
            >
              {loading ? (
                <Loader2 className={formFieldStyles.buttonIcon + " animate-spin"} />
              ) : (
                <RefreshCw className={formFieldStyles.buttonIcon} />
              )}
              REFRESH
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={formFieldStyles.button}
            >
              {saving ? (
                <Loader2 className={formFieldStyles.buttonIcon + " animate-spin"} />
              ) : (
                <Save className={formFieldStyles.buttonIcon} />
              )}
              SAVE
            </Button>
          </div>
        </CardHeader>
        <CardContent className={formFieldStyles.formSpacing}>
          <p className="text-[9px] text-muted-foreground mb-3">
            Set open/close times for each weekday. Closed days have no open/close time. Used for managing access and pricing.
          </p>
          <div className="space-y-2">
            {workingHours.map((row) => (
              <div
                key={row.dayOfWeek}
                className={`grid grid-cols-1 md:grid-cols-12 ${formFieldStyles.gridGap} items-center gap-2 border-b border-border/50 pb-2 last:border-0`}
              >
                <div className="md:col-span-2 font-medium text-[9px] uppercase">
                  {row.label}
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Switch
                    id={`closed-${row.dayOfWeek}`}
                    checked={row.isClosed}
                    onCheckedChange={(checked) =>
                      updateRow(row.dayOfWeek, { isClosed: checked })
                    }
                  />
                  <Label
                    htmlFor={`closed-${row.dayOfWeek}`}
                    className="text-[9px] uppercase"
                  >
                    Closed
                  </Label>
                </div>
                {!row.isClosed && (
                  <>
                    <div className={`md:col-span-2 ${formFieldStyles.fieldSpacing}`}>
                      <Label className={formFieldStyles.label}>OPEN</Label>
                      <Input
                        type="time"
                        value={row.openTime}
                        onChange={(e) =>
                          updateRow(row.dayOfWeek, { openTime: e.target.value })
                        }
                        className={formFieldStyles.input}
                      />
                    </div>
                    <div className={`md:col-span-2 ${formFieldStyles.fieldSpacing}`}>
                      <Label className={formFieldStyles.label}>CLOSE</Label>
                      <Input
                        type="time"
                        value={row.closeTime}
                        onChange={(e) =>
                          updateRow(row.dayOfWeek, { closeTime: e.target.value })
                        }
                        className={formFieldStyles.input}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
