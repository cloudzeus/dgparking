"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { format } from "date-fns";
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
import { FormCard } from "@/components/ui/form-card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { UserForm } from "./user-form";
import { deleteUser, toggleUserStatus } from "@/lib/actions/users";
import { getRoleBadgeStyles } from "@/lib/role-colors";
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

export function UsersClient({ users, currentUserRole }: UsersClientProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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


  const columns: Column<User>[] = [
    {
      key: "firstName",
      label: "NAME",
      sortable: true,
      render: (value, user) => (
        <span className="font-medium">
          {user.firstName} {user.lastName}
        </span>
      ),
    },
    {
      key: "email",
      label: "EMAIL",
      sortable: true,
      className: "font-medium",
    },
    {
      key: "role",
      label: "ROLE",
      sortable: true,
      render: (role: Role) => (
        <Badge
          className={`text-[8px] font-bold border ${getRoleBadgeStyles(role)}`}
        >
          {role}
        </Badge>
      ),
    },
    {
      key: "isActive",
      label: "STATUS",
      sortable: true,
      render: (isActive: boolean) => (
        <Badge
          variant={isActive ? "default" : "secondary"}
          className="text-[8px] font-bold"
        >
          {isActive ? "ACTIVE" : "INACTIVE"}
        </Badge>
      ),
    },
    {
      key: "mobile",
      label: "PHONE",
      sortable: false,
      render: (value, user) => (
        <span className="text-xs">
          {user.mobile || user.phone || "-"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "CREATED",
      sortable: true,
      render: (date: Date) => (
        <span className="text-xs">
          {format(new Date(date), "MM/dd/yyyy")}
        </span>
      ),
    },
  ];

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
      toast.success("User deleted successfully");
    }
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const handleToggleStatus = async (user: User) => {
    const result = await toggleUserStatus(user.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`User ${user.isActive ? "deactivated" : "activated"} successfully`);
    }
  };

  const actions = [
    {
      label: "Edit User",
      onClick: handleEdit,
    },
  ];

  return (
    <div ref={containerRef} className="space-y-6 opacity-0">
      <PageHeader
        title="USER MANAGEMENT"
        highlight="MANAGEMENT"
        subtitle="Manage users and their permissions"
      />

      <DataTable
        data={users}
        columns={columns}
        searchPlaceholder="Search users..."
        searchFields={["firstName", "lastName", "email"]}
        addButtonLabel="ADD USER"
        onAdd={() => setIsAddDialogOpen(true)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        actions={actions}
        storageKey="users-table"
        defaultVisibleColumns={["firstName", "email", "role", "isActive", "mobile", "createdAt"]}
      />

      {/* Add User Dialog */}
      <FormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title="ADD NEW USER"
        maxWidth="lg"
      >
        <UserForm
          mode="create"
          currentUserRole={currentUserRole}
          onSuccess={() => setIsAddDialogOpen(false)}
        />
      </FormDialog>

      {/* Edit User Dialog */}
      <FormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="EDIT USER"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">DELETE USER</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">
                {selectedUser?.firstName} {selectedUser?.lastName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              DELETE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

