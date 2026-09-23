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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/page";
import { Save, Lock, User } from "lucide-react";
import {
  updateProfile,
  changePassword,
  type ProfileState,
  type PasswordState,
} from "@/lib/actions/account";
import { countries } from "@/lib/data/countries";
import { roleLabel, roleVariant } from "@/lib/roles";
import { toast } from "sonner";

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
      toast.success("Το προφίλ ενημερώθηκε");
    }
  }, [profileState]);

  useEffect(() => {
    if (passwordState?.error) {
      toast.error(passwordState.error);
    }
    if (passwordState?.success) {
      toast.success("Ο κωδικός άλλαξε");
    }
  }, [passwordState]);

  const role = { label: roleLabel(user.role), variant: roleVariant(user.role) };
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
    user.email.slice(0, 2).toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString("el-GR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Athens",
  });

  return (
    <div ref={containerRef} className="space-y-4 opacity-0">
      <PageHeader
        title="Ο λογαριασμός μου"
        description="Διαχείριση των στοιχείων του προφίλ και του κωδικού πρόσβασης."
        icon={User}
      />

      {/* Σύνοψη λογαριασμού */}
      <Card>
        <CardContent className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{fullName}</h2>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={role.variant}>{role.label}</Badge>
              <span className="text-xs text-muted-foreground">Μέλος από {memberSince}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="size-4" aria-hidden />
            Προφίλ
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Lock className="size-4" aria-hidden />
            Ασφάλεια
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Στοιχεία προφίλ</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={profileAction} className="flex flex-col gap-4">
                {/* Βασικά στοιχεία */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">Βασικά στοιχεία</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="firstName" className="text-xs">
                        Όνομα *
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        defaultValue={user.firstName || ""}
                        required
                        disabled={isProfilePending}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="lastName" className="text-xs">
                        Επώνυμο *
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        defaultValue={user.lastName || ""}
                        required
                        disabled={isProfilePending}
                      />
                    </div>
                  </div>
                </div>

                {/* Στοιχεία επικοινωνίας */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">Στοιχεία επικοινωνίας</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="phone" className="text-xs">
                        Τηλέφωνο
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        defaultValue={user.phone || ""}
                        disabled={isProfilePending}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="mobile" className="text-xs">
                        Κινητό
                      </Label>
                      <Input
                        id="mobile"
                        name="mobile"
                        type="tel"
                        defaultValue={user.mobile || ""}
                        disabled={isProfilePending}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="workPhone" className="text-xs">
                        Τηλέφωνο εργασίας
                      </Label>
                      <Input
                        id="workPhone"
                        name="workPhone"
                        type="tel"
                        defaultValue={user.workPhone || ""}
                        disabled={isProfilePending}
                      />
                    </div>
                  </div>
                </div>

                {/* Διεύθυνση */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">Διεύθυνση</h3>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="address" className="text-xs">
                      Οδός και αριθμός
                    </Label>
                    <Input
                      id="address"
                      name="address"
                      defaultValue={user.address || ""}
                      disabled={isProfilePending}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="city" className="text-xs">
                        Πόλη
                      </Label>
                      <Input
                        id="city"
                        name="city"
                        defaultValue={user.city || ""}
                        disabled={isProfilePending}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="zip" className="text-xs">
                        Ταχυδρομικός κώδικας
                      </Label>
                      <Input
                        id="zip"
                        name="zip"
                        defaultValue={user.zip || ""}
                        disabled={isProfilePending}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="country" className="text-xs">
                        Χώρα
                      </Label>
                      <Select name="country" defaultValue={user.country || "GR"}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Επιλέξτε χώρα" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
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

                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isProfilePending} title="Αποθήκευση προφίλ">
                    {isProfilePending ? (
                      <>
                        <Spinner />
                        Αποθήκευση…
                      </>
                    ) : (
                      <>
                        <Save />
                        Αποθήκευση
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Αλλαγή κωδικού</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={passwordAction} className="flex max-w-md flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="currentPassword" className="text-xs">
                    Τρέχων κωδικός *
                  </Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    disabled={isPasswordPending}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="newPassword" className="text-xs">
                    Νέος κωδικός *
                  </Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={8}
                    disabled={isPasswordPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Τουλάχιστον 8 χαρακτήρες.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="confirmPassword" className="text-xs">
                    Επιβεβαίωση νέου κωδικού *
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    disabled={isPasswordPending}
                  />
                </div>

                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isPasswordPending} title="Αλλαγή κωδικού">
                    {isPasswordPending ? (
                      <>
                        <Spinner />
                        Αλλαγή…
                      </>
                    ) : (
                      <>
                        <Lock />
                        Αλλαγή κωδικού
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
