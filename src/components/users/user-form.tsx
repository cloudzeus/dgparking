"use client";

import { useEffect, useActionState } from "react";
import type { Role } from "@prisma/client";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { createUser, updateUser, type UserFormState } from "@/lib/actions/users";
import { countries } from "@/lib/data/countries";
import { formFieldStyles } from "@/lib/form-styles";
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
      toast.success(mode === "create" ? "User created successfully" : "User updated successfully");
      onSuccess();
    }
  }, [state, mode, onSuccess]);

  const availableRoles: Role[] =
    currentUserRole === "ADMIN"
      ? ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"]
      : ["MANAGER", "EMPLOYEE", "CLIENT"];

  return (
    <form action={formAction} className="space-y-3">
      {/* Basic Information */}
      <div className="space-y-2">
        <h3 className={formFieldStyles.sectionHeader}>
          BASIC INFORMATION
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="firstName" className={formFieldStyles.label}>
              FIRST NAME *
            </Label>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={user?.firstName || ""}
              required
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lastName" className={formFieldStyles.label}>
              LAST NAME *
            </Label>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={user?.lastName || ""}
              required
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="email" className={formFieldStyles.label}>
            EMAIL ADDRESS *
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={user?.email || ""}
            required
            disabled={isPending}
            className={formFieldStyles.input}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="password" className={formFieldStyles.label}>
              PASSWORD {mode === "create" ? "*" : "(leave blank to keep current)"}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required={mode === "create"}
              minLength={8}
              disabled={isPending}
              placeholder={mode === "edit" ? "••••••••" : ""}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role" className={formFieldStyles.label}>
              ROLE *
            </Label>
            <Select name="role" defaultValue={user?.role || "CLIENT"}>
              <SelectTrigger className={formFieldStyles.select}>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role} value={role} className={formFieldStyles.selectItem}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/30 p-2">
          <div className="space-y-0">
            <Label htmlFor="isActive" className={formFieldStyles.label}>
              ACTIVE STATUS
            </Label>
            <p className="text-[8px] text-muted-foreground">
              Inactive users cannot log in
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
            defaultChecked={user?.isActive !== false}
            onCheckedChange={(checked) => {
              const hiddenInput = document.querySelector(
                'input[name="isActive"]'
              ) as HTMLInputElement;
              if (hiddenInput) hiddenInput.value = checked ? "true" : "false";
            }}
            className="scale-75"
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-2">
        <h3 className={formFieldStyles.sectionHeader}>
          CONTACT INFORMATION
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="phone" className={formFieldStyles.label}>
              PHONE
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user?.phone || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mobile" className={formFieldStyles.label}>
              MOBILE
            </Label>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              defaultValue={user?.mobile || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="workPhone" className={formFieldStyles.label}>
              WORK PHONE
            </Label>
            <Input
              id="workPhone"
              name="workPhone"
              type="tel"
              defaultValue={user?.workPhone || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
        </div>
      </div>

      {/* Address Information */}
      <div className="space-y-2">
        <h3 className={formFieldStyles.sectionHeader}>
          ADDRESS INFORMATION
        </h3>
        <div className="space-y-1">
          <Label htmlFor="address" className={formFieldStyles.label}>
            ADDRESS
          </Label>
          <Input
            id="address"
            name="address"
            defaultValue={user?.address || ""}
            disabled={isPending}
            className={formFieldStyles.input}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="city" className={formFieldStyles.label}>
              CITY
            </Label>
            <Input
              id="city"
              name="city"
              defaultValue={user?.city || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="zip" className={formFieldStyles.label}>
              ZIP CODE
            </Label>
            <Input
              id="zip"
              name="zip"
              defaultValue={user?.zip || ""}
              disabled={isPending}
              className={formFieldStyles.input}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="country" className={formFieldStyles.label}>
              COUNTRY
            </Label>
            <Select name="country" defaultValue={user?.country || "GR"}>
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

      <div className="flex justify-end pt-2 border-t border-muted-foreground/20">
        <Button type="submit" disabled={isPending} className={formFieldStyles.button}>
          {isPending ? (
            <>
              <Loader2 className={`${formFieldStyles.buttonIcon} animate-spin`} />
              {mode === "create" ? "CREATING..." : "SAVING..."}
            </>
          ) : (
            <>
              <Save className={formFieldStyles.buttonIcon} />
              {mode === "create" ? "CREATE" : "SAVE"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

