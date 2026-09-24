"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsClient, type WorkingHoursRow } from "@/components/settings/settings-client";
import {
  MailgunSettingsClient,
  type MailgunSettingsData,
} from "@/components/settings/mailgun-settings-client";
import {
  CronSettingsClient,
  type CronIntegrationRow,
  type CronRuntimeStatus,
} from "@/components/settings/cron-settings-client";

export type SettingsTabsProps = {
  workingHours: WorkingHoursRow[];
  /** Οι καρτέλες διαχειριστή δεν φτάνουν καν στον browser όταν ο χρήστης δεν είναι ADMIN. */
  isAdmin: boolean;
  mailgun: MailgunSettingsData | null;
  cronIntegrations: CronIntegrationRow[];
  cronRuntime: CronRuntimeStatus;
};

export function SettingsTabs({
  workingHours,
  isAdmin,
  mailgun,
  cronIntegrations,
  cronRuntime,
}: SettingsTabsProps) {
  const [tab, setTab] = useState("working-hours");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="working-hours">Ωράριο λειτουργίας</TabsTrigger>
        {isAdmin && <TabsTrigger value="mailgun">Email (Mailgun)</TabsTrigger>}
        {isAdmin && <TabsTrigger value="cron">Χρονοπρογραμματισμός (cron)</TabsTrigger>}
      </TabsList>

      <TabsContent value="working-hours" className="mt-4">
        <SettingsClient initialWorkingHours={workingHours} />
      </TabsContent>

      {isAdmin && (
        <TabsContent value="mailgun" className="mt-4">
          <MailgunSettingsClient settings={mailgun} />
        </TabsContent>
      )}

      {isAdmin && (
        <TabsContent value="cron" className="mt-4">
          <CronSettingsClient integrations={cronIntegrations} runtime={cronRuntime} />
        </TabsContent>
      )}
    </Tabs>
  );
}
