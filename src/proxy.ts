import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

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

/**
 * Δημόσιο site (MEGA Parking): `/`, `/el`, `/en`, `/it` — το next-intl διαλέγει
 * γλώσσα και ανακατευθύνει. Δεν χρειάζονται σύνδεση.
 */
const intlMiddleware = createIntlMiddleware(routing);

const LOCALE_PATH = new RegExp(`^/(${routing.locales.join("|")})(/|$)`);

function isSitePath(pathname: string) {
  return pathname === "/" || LOCALE_PATH.test(pathname);
}

const authProxy = auth((req) => {
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

  // Φόρμες του δημόσιου site (επικοινωνία, αίτημα προσφοράς) — χωρίς σύνδεση.
  const isSiteFormRoute =
    nextUrl.pathname.startsWith("/api/send-contact") ||
    nextUrl.pathname.startsWith("/api/send-proposal") ||
    // Συγκατάθεση cookie, αιτήματα δικαιωμάτων και ο σύνδεσμος επιβεβαίωσής
    // τους: τα ασκεί ο επισκέπτης, χωρίς λογαριασμό (ΓΚΠΔ άρ. 12 §2).
    nextUrl.pathname.startsWith("/api/gdpr");

  if (isSoftOneApiRoute || isCronApiRoute || isAuthApiRoute || isWebhookRoute || isSiteFormRoute) {
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

export default function proxy(req: NextRequest, event: unknown) {
  if (isSitePath(req.nextUrl.pathname)) {
    return intlMiddleware(req);
  }
  return (authProxy as unknown as (req: NextRequest, event: unknown) => Response)(req, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
