import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Link/router με επίγνωση γλώσσας για τις δημόσιες σελίδες.
 * Για σελίδες χωρίς πρόθεμα (διαχείριση, σύνδεση) χρησιμοποίησε `next/link`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
