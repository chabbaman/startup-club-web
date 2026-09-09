import type { QueryCtx, MutationCtx } from "./_generated/server";

export const ALLOWED_DOMAINS = ["dlshs.org", "carondeleths.org"];

/** Accounts that can open the Teacher view and manage roles. */
export const TEACHER_EMAILS = ["25832@dlshs.org", "25870@dlshs.org", "thomasg@dlshs.org"];

export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const domain = email.toLowerCase().split("@")[1];
  return ALLOWED_DOMAINS.includes(domain ?? "");
}

export function isTeacherEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return TEACHER_EMAILS.includes(email.toLowerCase());
}

/** Returns the signed-in user's identity, or throws if they are not a club member. */
export async function requireMember(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not signed in");
  if (!isAllowedEmail(identity.email)) {
    throw new Error("Only @dlshs.org and @carondeleths.org accounts can access the board");
  }
  return identity;
}

/** Like requireMember, but only teacher accounts pass. */
export async function requireTeacher(ctx: QueryCtx | MutationCtx) {
  const identity = await requireMember(ctx);
  if (!isTeacherEmail(identity.email)) {
    throw new Error("Only teachers can manage roles");
  }
  return identity;
}
