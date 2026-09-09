export const ALLOWED_DOMAINS = ["dlshs.org", "carondeleths.org"] as const;

/** Accounts that can open the Teacher view and manage roles. */
export const TEACHER_EMAILS = [
  "25832@dlshs.org",
  "25870@dlshs.org",
  "thomasg@dlshs.org",
] as const;

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}

export function isTeacherEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (TEACHER_EMAILS as readonly string[]).includes(email.toLowerCase());
}
