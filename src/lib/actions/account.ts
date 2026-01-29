"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  address: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("GR"),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  workPhone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ProfileState = {
  error?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
};

export type PasswordState = {
  error?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
};

// Update profile action
export async function updateProfile(
  prevState: ProfileState | undefined,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const rawData = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    address: formData.get("address") || undefined,
    zip: formData.get("zip") || undefined,
    city: formData.get("city") || undefined,
    country: formData.get("country") || "GR",
    phone: formData.get("phone") || undefined,
    mobile: formData.get("mobile") || undefined,
    workPhone: formData.get("workPhone") || undefined,
  };

  const validatedFields = profileSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const data = validatedFields.data;

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        address: data.address,
        zip: data.zip,
        city: data.city,
        country: data.country,
        phone: data.phone,
        mobile: data.mobile,
        workPhone: data.workPhone,
      },
    });

    revalidatePath("/account");
    return { success: true };
  } catch {
    return { error: "Failed to update profile. Please try again." };
  }
}

// Change password action
export async function changePassword(
  prevState: PasswordState | undefined,
  formData: FormData
): Promise<PasswordState> {
  const session = await auth();
  
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const validatedFields = passwordSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const data = validatedFields.data;

  try {
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user?.password) {
      return { error: "User not found" };
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);

    if (!isPasswordValid) {
      return { error: "Current password is incorrect" };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return { success: true };
  } catch {
    return { error: "Failed to change password. Please try again." };
  }
}











