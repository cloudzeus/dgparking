"use client";

import { useEffect, useRef, useActionState } from "react";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { getRoleBadgeColor } from "@/lib/role-colors";
import { formFieldStyles } from "@/lib/form-styles";
import { Loader2, Save, Lock, User } from "lucide-react";
import {
  updateProfile,
  changePassword,
  type ProfileState,
  type PasswordState,
} from "@/lib/actions/account";
import { countries } from "@/lib/data/countries";
import { toast } from "sonner";
import { format } from "date-fns";

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  mobile: string | null;
  workPhone: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface AccountClientProps {
  user: UserData;
}

export function AccountClient({ user }: AccountClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [profileState, profileAction, isProfilePending] = useActionState<
    ProfileState | undefined,
    FormData
  >(updateProfile, undefined);

  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    PasswordState | undefined,
    FormData
  >(changePassword, undefined);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
      );
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (profileState?.error) {
      toast.error(profileState.error);
    }
    if (profileState?.success) {
      toast.success("Profile updated successfully");
    }
  }, [profileState]);

  useEffect(() => {
    if (passwordState?.error) {
      toast.error(passwordState.error);
    }
    if (passwordState?.success) {
      toast.success("Password changed successfully");
    }
  }, [passwordState]);


  return (
    <div ref={containerRef} className="space-y-6 opacity-0">
      <PageHeader
        title="MY ACCOUNT"
        highlight="ACCOUNT"
        subtitle="Manage your account settings and profile"
      />

      {/* Account Overview */}
      <Card className="group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <CardContent className="pt-4 relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
              <User className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge className={`text-[8px] font-bold ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </Badge>
                <span className="text-[9px] text-muted-foreground">
                  Member since {format(new Date(user.createdAt), "MMMM yyyy")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/50">
          <TabsTrigger 
            value="profile" 
            className="gap-1.5 text-[10px] h-7 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <User className="h-3 w-3" />
            PROFILE
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="gap-1.5 text-[10px] h-7 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Lock className="h-3 w-3" />
            SECURITY
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <CardHeader className="relative pb-3">
              <CardTitle className={formFieldStyles.sectionHeader}>
                PROFILE INFORMATION
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <form action={profileAction} className="space-y-3">
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
                        defaultValue={user.firstName || ""}
                        required
                        disabled={isProfilePending}
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
                        defaultValue={user.lastName || ""}
                        required
                        disabled={isProfilePending}
                        className={formFieldStyles.input}
                      />
                    </div>
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
                        defaultValue={user.phone || ""}
                        disabled={isProfilePending}
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
                        defaultValue={user.mobile || ""}
                        disabled={isProfilePending}
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
                        defaultValue={user.workPhone || ""}
                        disabled={isProfilePending}
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
                      defaultValue={user.address || ""}
                      disabled={isProfilePending}
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
                        defaultValue={user.city || ""}
                        disabled={isProfilePending}
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
                        defaultValue={user.zip || ""}
                        disabled={isProfilePending}
                        className={formFieldStyles.input}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="country" className={formFieldStyles.label}>
                        COUNTRY
                      </Label>
                      <Select name="country" defaultValue={user.country || "GR"}>
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
                  <Button type="submit" disabled={isProfilePending} className={formFieldStyles.button}>
                    {isProfilePending ? (
                      <>
                        <Loader2 className={`${formFieldStyles.buttonIcon} animate-spin`} />
                        SAVING...
                      </>
                    ) : (
                      <>
                        <Save className={formFieldStyles.buttonIcon} />
                        SAVE
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <CardHeader className="relative pb-3">
              <CardTitle className={formFieldStyles.sectionHeader}>CHANGE PASSWORD</CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <form action={passwordAction} className="max-w-md space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="currentPassword" className={formFieldStyles.label}>
                    CURRENT PASSWORD *
                  </Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    disabled={isPasswordPending}
                    className={formFieldStyles.input}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="newPassword" className={formFieldStyles.label}>
                    NEW PASSWORD *
                  </Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={8}
                    disabled={isPasswordPending}
                    className={formFieldStyles.input}
                  />
                  <p className="text-[8px] text-muted-foreground">
                    Must be at least 8 characters
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className={formFieldStyles.label}>
                    CONFIRM NEW PASSWORD *
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    disabled={isPasswordPending}
                    className={formFieldStyles.input}
                  />
                </div>

                <div className="flex justify-end pt-2 border-t border-muted-foreground/20">
                  <Button type="submit" disabled={isPasswordPending} className={formFieldStyles.button}>
                    {isPasswordPending ? (
                      <>
                        <Loader2 className={`${formFieldStyles.buttonIcon} animate-spin`} />
                        CHANGING...
                      </>
                    ) : (
                      <>
                        <Lock className={formFieldStyles.buttonIcon} />
                        CHANGE
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

