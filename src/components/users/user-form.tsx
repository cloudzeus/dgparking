"use client";

import { useEffect, useActionState } from "react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { createUser, updateUser, type UserFormState } from "@/lib/actions/users";
import { countries } from "@/lib/data/countries";
import { roleLabel } from "@/lib/roles";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  isActive: boolean;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  mobile: string | null;
  workPhone: string | null;
}

interface UserFormProps {
  mode: "create" | "edit";
  user?: User;
  currentUserRole: Role;
  onSuccess: () => void;
}

const sectionHeader = "text-xs font-semibold text-muted-foreground";
const fieldLabel = "text-xs font-medium";

export function UserForm({ mode, user, currentUserRole, onSuccess }: UserFormProps) {
  const boundUpdateUser = user
    ? updateUser.bind(null, user.id)
    : createUser;

  const [state, formAction, isPending] = useActionState<UserFormState | undefined, FormData>(
    mode === "create" ? createUser : boundUpdateUser,
    undefined
  );

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
      toast.success(mode === "create" ? "Ο χρήστης δημιουργήθηκε" : "Ο χρήστης ενημερώθηκε");
      onSuccess();
    }
  }, [state, mode, onSuccess]);

  const availableRoles: Role[] =
    currentUserRole === "ADMIN"
      ? ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"]
      : ["MANAGER", "EMPLOYEE", "CLIENT"];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Βασικά στοιχεία */}
      <div className="flex flex-col gap-2">
        <h3 className={sectionHeader}>Βασικά στοιχεία</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="firstName" className={fieldLabel}>
              Όνομα *
            </Label>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={user?.firstName || ""}
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lastName" className={fieldLabel}>
              Επώνυμο *
            </Label>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={user?.lastName || ""}
              required
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="email" className={fieldLabel}>
            Διεύθυνση email *
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={user?.email || ""}
            required
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="password" className={fieldLabel}>
              Κωδικός {mode === "create" ? "*" : "(κενό = παραμένει ο ίδιος)"}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required={mode === "create"}
              minLength={8}
              disabled={isPending}
              placeholder={mode === "edit" ? "••••••••" : ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="role" className={fieldLabel}>
              Ρόλος *
            </Label>
            <Select name="role" defaultValue={user?.role || "CLIENT"}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Επιλογή ρόλου" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-2">
          <div className="min-w-0">
            <Label htmlFor="isActive" className={fieldLabel}>
              Ενεργός λογαριασμός
            </Label>
            <p className="text-xs text-muted-foreground">
              Οι ανενεργοί χρήστες δεν μπορούν να συνδεθούν.
            </p>
          </div>
          <input
            type="hidden"
            name="isActive"
            value={user?.isActive !== false ? "true" : "false"}
          />
          <Switch
            id="isActive"
            name="isActiveSwitch"
            aria-label="Ενεργός λογαριασμός"
            defaultChecked={user?.isActive !== false}
            onCheckedChange={(checked) => {
              const hiddenInput = document.querySelector(
                'input[name="isActive"]'
              ) as HTMLInputElement;
              if (hiddenInput) hiddenInput.value = checked ? "true" : "false";
            }}
          />
        </div>
      </div>

      {/* Στοιχεία επικοινωνίας */}
      <div className="flex flex-col gap-2">
        <h3 className={sectionHeader}>Στοιχεία επικοινωνίας</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="phone" className={fieldLabel}>
              Σταθερό
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user?.phone || ""}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mobile" className={fieldLabel}>
              Κινητό
            </Label>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              defaultValue={user?.mobile || ""}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="workPhone" className={fieldLabel}>
              Τηλέφωνο εργασίας
            </Label>
            <Input
              id="workPhone"
              name="workPhone"
              type="tel"
              defaultValue={user?.workPhone || ""}
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {/* Διεύθυνση */}
      <div className="flex flex-col gap-2">
        <h3 className={sectionHeader}>Διεύθυνση</h3>
        <div className="flex flex-col gap-1">
          <Label htmlFor="address" className={fieldLabel}>
            Οδός και αριθμός
          </Label>
          <Input
            id="address"
            name="address"
            defaultValue={user?.address || ""}
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="city" className={fieldLabel}>
              Πόλη
            </Label>
            <Input
              id="city"
              name="city"
              defaultValue={user?.city || ""}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="zip" className={fieldLabel}>
              Ταχυδρομικός κώδικας
            </Label>
            <Input
              id="zip"
              name="zip"
              defaultValue={user?.zip || ""}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="country" className={fieldLabel}>
              Χώρα
            </Label>
            <Select name="country" defaultValue={user?.country || "GR"}>
              <SelectTrigger id="country" className="w-full">
                <SelectValue placeholder="Επιλογή χώρας" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                <SelectGroup>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t pt-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {mode === "create" ? "Δημιουργία…" : "Αποθήκευση…"}
            </>
          ) : (
            <>
              <Save className="size-4" />
              {mode === "create" ? "Δημιουργία" : "Αποθήκευση"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
