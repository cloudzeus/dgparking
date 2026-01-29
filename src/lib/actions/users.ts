"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

// Validation schemas
const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"]),
  address: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("GR"),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  workPhone: z.string().optional(),
  isActive: z.boolean().default(true),
});

const createUserSchema = userSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const updateUserSchema = userSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

export type UserFormState = {
  error?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
};

// Create user action
export async function createUser(
  prevState: UserFormState | undefined,
  formData: FormData
): Promise<UserFormState> {
  const session = await auth();
  
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role"),
    address: formData.get("address") || undefined,
    zip: formData.get("zip") || undefined,
    city: formData.get("city") || undefined,
    country: formData.get("country") || "GR",
    phone: formData.get("phone") || undefined,
    mobile: formData.get("mobile") || undefined,
    workPhone: formData.get("workPhone") || undefined,
    isActive: formData.get("isActive") === "true",
  };

  const validatedFields = createUserSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const data = validatedFields.data;

  // Check if manager is trying to create admin
  if (session.user.role === "MANAGER" && data.role === "ADMIN") {
    return { error: "Managers cannot create admin users" };
  }

  try {
    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { error: "A user with this email already exists" };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as Role,
        address: data.address,
        zip: data.zip,
        city: data.city,
        country: data.country,
        phone: data.phone,
        mobile: data.mobile,
        workPhone: data.workPhone,
        isActive: data.isActive,
      },
    });

    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Failed to create user. Please try again." };
  }
}

// Update user action
export async function updateUser(
  userId: string,
  prevState: UserFormState | undefined,
  formData: FormData
): Promise<UserFormState> {
  const session = await auth();
  
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const rawData = {
    email: formData.get("email"),
    password: formData.get("password") || undefined,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role"),
    address: formData.get("address") || undefined,
    zip: formData.get("zip") || undefined,
    city: formData.get("city") || undefined,
    country: formData.get("country") || "GR",
    phone: formData.get("phone") || undefined,
    mobile: formData.get("mobile") || undefined,
    workPhone: formData.get("workPhone") || undefined,
    isActive: formData.get("isActive") === "true",
  };

  const validatedFields = updateUserSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const data = validatedFields.data;

  // Check if manager is trying to update to admin
  if (session.user.role === "MANAGER" && data.role === "ADMIN") {
    return { error: "Managers cannot assign admin role" };
  }

  try {
    // Check if email exists (excluding current user)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id: userId },
      },
    });

    if (existingUser) {
      return { error: "A user with this email already exists" };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as Role,
      address: data.address,
      zip: data.zip,
      city: data.city,
      country: data.country,
      phone: data.phone,
      mobile: data.mobile,
      workPhone: data.workPhone,
      isActive: data.isActive,
    };

    // Only hash and update password if provided
    if (data.password && data.password.length >= 8) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Failed to update user. Please try again." };
  }
}

// Delete user action
export async function deleteUser(userId: string): Promise<UserFormState> {
  const session = await auth();
  
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Unauthorized" };
  }

  // Prevent self-deletion
  if (userId === session.user.id) {
    return { error: "You cannot delete your own account" };
  }

  try {
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToDelete) {
      return { error: "User not found" };
    }

    // Check if manager is trying to delete admin
    if (session.user.role === "MANAGER" && userToDelete.role === "ADMIN") {
      return { error: "Managers cannot delete admin users" };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Failed to delete user. Please try again." };
  }
}

// Toggle user active status
export async function toggleUserStatus(userId: string): Promise<UserFormState> {
  const session = await auth();
  
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: "User not found" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Failed to update user status. Please try again." };
  }
}











