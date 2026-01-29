import type { Role } from "@prisma/client";

export const getRoleBadgeStyles = (role: Role): string => {
  switch (role) {
    case "ADMIN":
      return "bg-red-500/10 text-red-700 border-red-500/20 hover:bg-red-500/20";
    case "MANAGER":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20";
    case "EMPLOYEE":
      return "bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20";
    case "CLIENT":
      return "bg-purple-500/10 text-purple-700 border-purple-500/20 hover:bg-purple-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20 hover:bg-gray-500/20";
  }
};

export const getRoleBadgeColor = (role: Role): string => {
  switch (role) {
    case "ADMIN":
      return "bg-red-500/10 text-red-600";
    case "MANAGER":
      return "bg-blue-500/10 text-blue-600";
    case "EMPLOYEE":
      return "bg-green-500/10 text-green-600";
    case "CLIENT":
      return "bg-violet-500/10 text-violet-600";
    default:
      return "bg-gray-500/10 text-gray-600";
  }
};










