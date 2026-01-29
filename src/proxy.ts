import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

// Routes that require specific roles
const roleRoutes: Record<string, string[]> = {
  "/admin": ["ADMIN"],
  "/manager": ["ADMIN", "MANAGER"],
  "/employee": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "/client": ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"],
  "/dashboard": ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"],
};

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  // Allow public routes and API routes
  const isPublicRoute = publicRoutes.some(
    (route) => nextUrl.pathname === route || nextUrl.pathname.startsWith("/api/auth")
  );
  
  // Allow SoftOne API routes (they handle their own authentication)
  const isSoftOneApiRoute = nextUrl.pathname.startsWith("/api/softone");
  
  // Allow Cron API routes (they handle their own authentication via X-Cron-Secret)
  const isCronApiRoute = nextUrl.pathname.startsWith("/api/cron");
  
  // Allow Auth API routes
  const isAuthApiRoute = nextUrl.pathname.startsWith("/api/auth");
  
  // Allow Webhook routes (cameras need to POST without authentication)
  const isWebhookRoute = nextUrl.pathname.startsWith("/api/webhooks");
  
  if (isSoftOneApiRoute || isCronApiRoute || isAuthApiRoute || isWebhookRoute) {
    return NextResponse.next();
  }

  if (isPublicRoute) {
    // Redirect logged in users away from auth pages
    if (isLoggedIn && ["/login", "/register"].includes(nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Check if user is logged in
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // Check role-based access
  for (const [route, allowedRoles] of Object.entries(roleRoutes)) {
    if (nextUrl.pathname.startsWith(route)) {
      if (!userRole || !allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
      break;
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};



