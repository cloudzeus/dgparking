/**
 * Όλα τα πρότυπα email σε ένα σημείο.
 *
 * Κάθε πρότυπο είναι καθαρή συνάρτηση: παίρνει props και επιστρέφει
 * `{ subject, html, text }`. Καμία πρόσβαση σε βάση ή δίκτυο — η αποστολή
 * γίνεται από το `@/lib/mailgun`.
 */

export { BRAND, COMPANY, CONTENT_WIDTH, FONT_STACK, LOGO_URL, MONO_STACK } from "./brand";
export { button, dataRow, dataTable, escapeHtml, renderEmail, textVersion } from "./layout";
export type { EmailLayoutOptions } from "./layout";

export type { RenderedEmail, GdprRequestType } from "./templates/_shared";
export { GDPR_REQUEST_LABELS } from "./templates/_shared";

export { newsletterConfirmEmail } from "./templates/newsletter-confirm";
export type { NewsletterConfirmProps } from "./templates/newsletter-confirm";

export { newsletterWelcomeEmail } from "./templates/newsletter-welcome";
export type { NewsletterWelcomeProps } from "./templates/newsletter-welcome";

export { passwordResetEmail } from "./templates/password-reset";
export type { PasswordResetProps } from "./templates/password-reset";

export { passwordChangedEmail } from "./templates/password-changed";
export type { PasswordChangedProps } from "./templates/password-changed";

export { welcomeAccountEmail } from "./templates/welcome-account";
export type { WelcomeAccountProps } from "./templates/welcome-account";

export { contactReceivedEmail } from "./templates/contact-received";
export type { ContactReceivedProps } from "./templates/contact-received";

export { proposalReceivedEmail } from "./templates/proposal-received";
export type { ProposalReceivedProps } from "./templates/proposal-received";


export { gdprRequestReceivedEmail } from "./templates/gdpr-request-received";
export type { GdprRequestReceivedProps } from "./templates/gdpr-request-received";

export { gdprRequestCompletedEmail } from "./templates/gdpr-request-completed";
export type { GdprRequestCompletedProps } from "./templates/gdpr-request-completed";
