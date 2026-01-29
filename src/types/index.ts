// Global type definitions
import type { Role } from "@prisma/client";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Re-export Role from Prisma
export type { Role };

// User types
export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  isActive: boolean;
  image: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  mobile: string | null;
  workPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

// Session user type (subset used in auth)
export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
}

// Form state types
export interface FormState {
  error?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
}
