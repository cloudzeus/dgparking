import type { Role } from "@prisma/client";

/**
 * Ένα λεξικό ρόλων για όλη την εφαρμογή: ίδια ελληνική λέξη και ίδιο χρώμα
 * Badge για τον ίδιο ρόλο, σε κάθε σελίδα (DG: χρώμα μόνο μέσω variants).
 */
const ROLES = {
  ADMIN: { label: "Διαχειριστής", variant: "danger" },
  MANAGER: { label: "Υπεύθυνος", variant: "info" },
  EMPLOYEE: { label: "Υπάλληλος", variant: "success" },
  CLIENT: { label: "Πελάτης", variant: "accent" },
} as const satisfies Record<Role, { label: string; variant: string }>;

type RoleInfo = (typeof ROLES)[Role];

export function roleLabel(role: Role): string {
  return ROLES[role]?.label ?? role;
}

export function roleVariant(role: Role): RoleInfo["variant"] | "neutral" {
  return ROLES[role]?.variant ?? "neutral";
}
