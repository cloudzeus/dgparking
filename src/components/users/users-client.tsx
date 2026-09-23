"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { ColumnDef, VisibilityState } from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader, StatusBadge } from "@/components/admin/page";
import { Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { UserForm } from "./user-form";
import { deleteUser, toggleUserStatus } from "@/lib/actions/users";
import { roleLabel, roleVariant } from "@/lib/roles";
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
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface UsersClientProps {
  users: User[];
  currentUserRole: Role;
}

const nf = new Intl.NumberFormat("el-GR");

/** Ημερομηνία σε ελληνική μορφή, ώρα Ελλάδας. */
function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

function fullName(user: User) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || "Χωρίς όνομα";
}

/** Δευτερεύουσες στήλες: κρυμμένες ώστε ο πίνακας να χωρά σε 1440px χωρίς οριζόντια κύλιση. */
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  email: false,
  lastLoginAt: false,
  city: false,
};

export function UsersClient({ users, currentUserRole }: UsersClientProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    const result = await deleteUser(selectedUser.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Ο χρήστης διαγράφηκε");
    }
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const handleToggleStatus = async (user: User) => {
    const result = await toggleUserStatus(user.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(user.isActive ? "Ο χρήστης απενεργοποιήθηκε" : "Ο χρήστης ενεργοποιήθηκε");
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.firstName, user.lastName, user.email].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [users, search]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
      admins: users.filter((u) => u.role === "ADMIN" || u.role === "MANAGER").length,
    }),
    [users]
  );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "firstName",
        meta: { label: "Ονοματεπώνυμο", flex: true },
        header: "Ονοματεπώνυμο",
        size: 260,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="min-w-0">
              <div className="truncate font-medium" title={fullName(user)}>
                {fullName(user)}
              </div>
              <div className="truncate text-xs text-muted-foreground" title={user.email}>
                {user.email}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        meta: { label: "Email" },
        header: "Email",
        size: 220,
        cell: ({ row }) => (
          <span className="truncate" title={row.original.email}>
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: "role",
        meta: { label: "Ρόλος" },
        header: "Ρόλος",
        size: 130,
        cell: ({ row }) => (
          <Badge variant={roleVariant(row.original.role)}>{roleLabel(row.original.role)}</Badge>
        ),
      },
      {
        accessorKey: "isActive",
        meta: { label: "Κατάσταση" },
        header: "Κατάσταση",
        size: 120,
        cell: ({ row }) => <StatusBadge status={row.original.isActive ? "ACTIVE" : "INACTIVE"} />,
      },
      {
        accessorKey: "mobile",
        meta: { label: "Τηλέφωνο" },
        header: "Τηλέφωνο",
        size: 150,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.mobile || row.original.phone || "—"}</span>
        ),
      },
      {
        accessorKey: "city",
        meta: { label: "Πόλη" },
        header: "Πόλη",
        size: 140,
        cell: ({ row }) => (
          <span className="truncate">{row.original.city || "—"}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Δημιουργήθηκε", align: "right" },
        header: "Δημιουργήθηκε",
        size: 130,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{formatDate(row.original.createdAt)}</div>
        ),
      },
      {
        accessorKey: "lastLoginAt",
        meta: { label: "Τελευταία σύνδεση", align: "right" },
        header: "Τελευταία σύνδεση",
        size: 160,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{formatDateTime(row.original.lastLoginAt)}</div>
        ),
      },
    ],
    []
  );

  return (
    <div ref={containerRef} className="space-y-4 opacity-0">
      <PageHeader
        className="mb-0"
        title="Χρήστες"
        description="Λογαριασμοί της εφαρμογής, ρόλοι και στοιχεία επικοινωνίας. Από εδώ δημιουργείτε χρήστες, αλλάζετε ρόλο και ενεργοποιείτε ή απενεργοποιείτε πρόσβαση."
        icon={Users}
        actions={
          <Button onClick={() => setIsAddDialogOpen(true)} title="Δημιουργία νέου λογαριασμού">
            <Plus className="size-4" />
            Νέος χρήστης
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Σύνολο χρηστών"
          value={nf.format(counts.total)}
          hint="όλοι οι ρόλοι"
          icon={Users}
          tone="blue"
        />
        <KpiTile
          label="Ενεργοί"
          value={nf.format(counts.active)}
          hint="μπορούν να συνδεθούν"
          icon={UserCheck}
          tone="green"
        />
        <KpiTile
          label="Ανενεργοί"
          value={nf.format(counts.inactive)}
          hint="δεν επιτρέπεται η σύνδεση"
          icon={UserX}
          tone="amber"
        />
        <KpiTile
          label="Διαχείριση"
          value={nf.format(counts.admins)}
          hint="Διαχειριστές και Υπεύθυνοι"
          icon={ShieldCheck}
          tone="red"
        />
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="Δεν υπάρχουν χρήστες"
          description="Δημιουργήστε τον πρώτο λογαριασμό για να δώσετε πρόσβαση στην εφαρμογή."
          icon={Users}
          action={
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="size-4" />
              Νέος χρήστης
            </Button>
          }
        />
      ) : filteredUsers.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="Κανένας χρήστης δεν ταιριάζει στην αναζήτηση"
            description={`Δεν βρέθηκε χρήστης για «${search}». Δοκιμάστε όνομα, επώνυμο ή email.`}
            icon={Users}
            action={
              <Button variant="outline" onClick={() => setSearch("")}>
                Καθαρισμός αναζήτησης
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredUsers}
          title={`${nf.format(filteredUsers.length)} χρήστες`}
          searchPlaceholder="Αναζήτηση με όνομα, επώνυμο ή email…"
          searchValue={search}
          onSearchChange={setSearch}
          totalItems={filteredUsers.length}
          pageSize={filteredUsers.length || 1}
          currentPage={1}
          totalPages={1}
          showExport={false}
          getRowId={(user) => user.id}
          columnVisibility={DEFAULT_COLUMN_VISIBILITY}
          fixedLayout
          expandableContent={(user) => (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{fullName(user)}</span>
                <Badge variant={roleVariant(user.role)}>{roleLabel(user.role)}</Badge>
                <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
              </div>
              <p className="text-xs text-muted-foreground">
                {user.email} · Δημιουργήθηκε {formatDateTime(user.createdAt)} · Τελευταία σύνδεση{" "}
                {formatDateTime(user.lastLoginAt)}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => handleEdit(user)}>
                  <Pencil className="size-4" />
                  Επεξεργασία
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleToggleStatus(user)}>
                  {user.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                  {user.isActive ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive"
                  onClick={() => handleDelete(user)}
                >
                  <Trash2 className="size-4" />
                  Διαγραφή
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <InfoPanel title="Λογαριασμός" accent="bg-chart-1">
                  <InfoRow label="Email">{user.email}</InfoRow>
                  <InfoRow label="Ρόλος">{roleLabel(user.role)}</InfoRow>
                  <InfoRow label="Κατάσταση">{user.isActive ? "Ενεργός" : "Ανενεργός"}</InfoRow>
                </InfoPanel>
                <InfoPanel title="Επικοινωνία" accent="bg-chart-2">
                  <InfoRow label="Κινητό">{user.mobile || "—"}</InfoRow>
                  <InfoRow label="Τηλέφωνο">{user.phone || "—"}</InfoRow>
                  <InfoRow label="Τηλέφωνο εργασίας">{user.workPhone || "—"}</InfoRow>
                </InfoPanel>
                <InfoPanel title="Διεύθυνση" accent="bg-chart-3">
                  <InfoRow label="Οδός" wrap>
                    {user.address || "—"}
                  </InfoRow>
                  <InfoRow label="Πόλη">{user.city || "—"}</InfoRow>
                  <InfoRow label="Τ.Κ.">{user.zip || "—"}</InfoRow>
                  <InfoRow label="Χώρα">{user.country || "—"}</InfoRow>
                </InfoPanel>
                <InfoPanel title="Ιστορικό" accent="bg-chart-4">
                  <InfoRow label="Δημιουργήθηκε">{formatDateTime(user.createdAt)}</InfoRow>
                  <InfoRow label="Τελευταία σύνδεση">{formatDateTime(user.lastLoginAt)}</InfoRow>
                  <InfoRow label="Αναγνωριστικό" mono>
                    {user.id}
                  </InfoRow>
                </InfoPanel>
              </div>
            </div>
          )}
        />
      )}

      {/* Παράθυρο δημιουργίας χρήστη */}
      <FormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title="Νέος χρήστης"
        maxWidth="lg"
      >
        <UserForm
          mode="create"
          currentUserRole={currentUserRole}
          onSuccess={() => setIsAddDialogOpen(false)}
        />
      </FormDialog>

      {/* Παράθυρο επεξεργασίας χρήστη */}
      <FormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="Επεξεργασία χρήστη"
        maxWidth="lg"
      >
        {selectedUser && (
          <UserForm
            mode="edit"
            user={selectedUser}
            currentUserRole={currentUserRole}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              setSelectedUser(null);
            }}
          />
        )}
      </FormDialog>

      {/* Επιβεβαίωση διαγραφής */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή χρήστη</AlertDialogTitle>
            <AlertDialogDescription>
              Θέλετε σίγουρα να διαγράψετε τον χρήστη{" "}
              <span className="font-medium">{selectedUser ? fullName(selectedUser) : ""}</span>; Η
              ενέργεια δεν αναιρείται.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
