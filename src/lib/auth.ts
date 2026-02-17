import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    firstName: string | null;
    lastName: string | null;
  }
  
  interface Session {
    user: {
      id: string;
      email: string;
      role: Role;
      firstName: string | null;
      lastName: string | null;
      image: string | null;
    };
  }

  interface JWT {
    id: string;
    role: Role;
    firstName: string | null;
    lastName: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        if (!user.isActive) {
          throw new Error("Account is deactivated");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Update last login in background so login response isn't delayed by DB round-trip
        void prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch((err) => console.error("[auth] lastLoginAt update failed", err));

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.firstName = token.firstName as string | null;
        session.user.lastName = token.lastName as string | null;
      }
      return session;
    },
  },
});

// Helper function to get current user session
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

// Helper function to check if user has required role
export function hasRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole);
}

// Role hierarchy for permission checking
export const roleHierarchy: Record<Role, number> = {
  ADMIN: 4,
  MANAGER: 3,
  EMPLOYEE: 2,
  CLIENT: 1,
};

export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minimumRole];
}
