export const ALLOWED_DOMAINS = ["dlshs.org", "carondeleths.org"] as const;

/** Individual emails allowed even though their domain is not. */
export const ALLOWED_EMAILS = ["izabelbaker0@gmail.com"] as const;

/** Accounts that can open the Teacher view and manage roles. */
export const TEACHER_EMAILS = [
  "25832@dlshs.org",
  "25870@dlshs.org",
  "thomasg@dlshs.org",
] as const;

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if ((ALLOWED_EMAILS as readonly string[]).includes(lower)) return true;
  const domain = lower.split("@")[1] ?? "";
  return (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}

export function isTeacherEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (TEACHER_EMAILS as readonly string[]).includes(email.toLowerCase());
}
