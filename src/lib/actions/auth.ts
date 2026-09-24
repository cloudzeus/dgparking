"use server";

import { signIn, signOut } from "@/lib/auth";
import { isValidAfm, normalizeAfm } from "@/lib/afm";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import crypto from "crypto";

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  afm: z
    .string()
    .min(1, "Το ΑΦΜ είναι υποχρεωτικό")
    .refine((v) => isValidAfm(v), "Μη έγκυρο ΑΦΜ — έλεγξε τα ψηφία"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type LoginState = {
  error?: string;
  success?: boolean;
};

export type RegisterState = {
  error?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
  /** Ο λογαριασμός δημιουργήθηκε αλλά περιμένει έγκριση διαχειριστή. */
  pendingApproval?: boolean;
  /** Η επωνυμία που βρέθηκε για το ΑΦΜ, αν βρέθηκε. */
  matchedName?: string | null;
};

export type ForgotPasswordState = {
  error?: string;
  success?: boolean;
};

export type ResetPasswordState = {
  error?: string;
  success?: boolean;
};

// Login action
export async function login(
  prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: "Invalid credentials" };
  }

  const { email, password } = validatedFields.data;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    const callbackUrl = (formData.get("callbackUrl") as string)?.trim() || "/dashboard";
    const safeUrl = callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
    redirect(safeUrl);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password" };
        default:
          return { error: "Something went wrong" };
      }
    }
    // Next.js redirect() throws; rethrow so the framework can perform the redirect
    const digest = error && typeof error === "object" && "digest" in error ? (error as { digest?: string }).digest : "";
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Login error:", error);
    return { error: "Network error occurred" };
  }
}

// Register action
export async function register(
  prevState: RegisterState | undefined,
  formData: FormData
): Promise<RegisterState> {
  const validatedFields = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    afm: formData.get("afm"),
  });

  if (!validatedFields.success) {
    return {
      error: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password, firstName, lastName, afm } = validatedFields.data;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "An account with this email already exists" };
    }

    const normalizedAfm = normalizeAfm(afm);

    // Αντιστοίχιση με πελάτη του ERP. Γίνεται ΤΩΡΑ για να δει ο διαχειριστής
    // ποιον αφορά το αίτημα, αλλά ΔΕΝ δίνει πρόσβαση: το ΑΦΜ είναι δημόσιο.
    const customer = await prisma.cUSTORMER.findFirst({
      where: { AFM: normalizedAfm },
      select: { TRDR: true, NAME: true },
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "CLIENT",
        isActive: false, // ενεργοποιείται με την έγκριση
        portalAccess: {
          create: {
            afm: normalizedAfm,
            trdr: customer?.TRDR ?? null,
            matchedName: customer?.NAME ?? null,
            status: "PENDING",
          },
        },
      },
    });

    return { success: true, pendingApproval: true, matchedName: customer?.NAME ?? null };
  } catch {
    return { error: "Failed to create account. Please try again." };
  }
}

// Forgot password action
export async function forgotPassword(
  prevState: ForgotPasswordState | undefined,
  formData: FormData
): Promise<ForgotPasswordState> {
  const validatedFields = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { error: "Invalid email address" };
  }

  const { email } = validatedFields.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    // Delete any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    // Save token
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // TODO: Send email with reset link
    // For now, log the token (remove in production)
    console.log(`Password reset token for ${email}: ${token}`);

    return { success: true };
  } catch {
    return { error: "Failed to process request. Please try again." };
  }
}

// Reset password action
export async function resetPassword(
  prevState: ResetPasswordState | undefined,
  formData: FormData
): Promise<ResetPasswordState> {
  const validatedFields = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return { error: "Invalid input" };
  }

  const { token, password } = validatedFields.data;

  try {
    // Find token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return { error: "Invalid or expired reset link" };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
    });

    // Delete used token
    await prisma.passwordResetToken.delete({
      where: { token },
    });

    return { success: true };
  } catch {
    return { error: "Failed to reset password. Please try again." };
  }
}

// Logout action
export async function logout() {
  await signOut({ redirect: false });
  redirect("/login");
}

