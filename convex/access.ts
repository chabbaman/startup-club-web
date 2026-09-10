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

/**
 * Card ownership: only the member who created the card, or a teacher, may
 * change it (edit, move, delete, attachments). Everyone else gets an error.
 */
export async function requireCardEditor(
  ctx: QueryCtx | MutationCtx,
  card: { createdBy: string },
) {
  const identity = await requireMember(ctx);
  if (!canEditCard(identity, card)) {
    throw new Error("Only the person who created this card (or a teacher) can change it");
  }
  return identity;
}

/** Pure ownership check shared by the card and column guards. */
export function canEditCard(
  identity: { subject: string; email?: string },
  card: { createdBy: string },
): boolean {
  return card.createdBy === identity.subject || isTeacherEmail(identity.email);
}

/**
 * Deleting a column deletes every card in it, so a member may only do that
 * when every card in the column is their own. Teachers may always.
 */
export async function requireColumnDeleter(
  ctx: QueryCtx | MutationCtx,
  cards: { createdBy: string }[],
) {
  const identity = await requireMember(ctx);
  if (!isTeacherEmail(identity.email) && cards.some((c) => c.createdBy !== identity.subject)) {
    throw new Error("This column has cards made by other people; only a teacher can delete it");
  }
  return identity;
}
