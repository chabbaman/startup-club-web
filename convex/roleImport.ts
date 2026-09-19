import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { Infer } from "convex/values";
import type { columnColor } from "./schema";

type Color = Infer<typeof columnColor>;

/** Roles derived from the fall 2026 signup form, created on demand by the import. */
export const FORM_ROLES: Record<string, Color> = {
  Engineering: "sky",
  "Marketing & Social": "coral",
  "Media & Design": "violet",
  "Business & Strategy": "amber",
  "Outreach & Ops": "teal",
};

/**
 * Role assignments from the signup form, keyed by the email each member gave.
 * Applied by `roles.importFormRoles` for members who already signed in, and by
 * `roles.ensureUser` the first time a listed member opens the dashboard.
 */
export const FORM_ASSIGNMENTS: Record<string, (keyof typeof FORM_ROLES)[]> = {
  "echeng28@dlshs.org": ["Media & Design", "Marketing & Social", "Business & Strategy"],
  "25867@dlshs.org": ["Media & Design", "Marketing & Social"],
  "26008@dlshs.org": ["Engineering"],
  "25925@dlshs.org": ["Engineering", "Media & Design"],
  "nashley29@dlshs.org": ["Marketing & Social", "Media & Design"],
  "rtancuan@gmail.com": ["Outreach & Ops"],
  "25961@dlshs.org": ["Engineering", "Media & Design"],
  "lchang29@dlshs.org": ["Marketing & Social", "Media & Design", "Business & Strategy"],
  "26002@dlshs.org": ["Business & Strategy", "Marketing & Social"],
  "anosrati30@dlshs.org": ["Media & Design"],
  "25829@dlshs.org": ["Engineering"],
  "25942@dlshs.org": ["Media & Design", "Engineering", "Marketing & Social"],
  "25877@dlshs.org": ["Engineering", "Business & Strategy", "Outreach & Ops"],
  "25923@dlshs.org": ["Marketing & Social", "Media & Design"],
  "atang28@dlshs.org": ["Outreach & Ops", "Media & Design"],
  "25855@dlshs.org": ["Engineering"],
  "aaguilar29@dlshs.org": ["Media & Design"],
  "wfoster29@dlshs.org": ["Business & Strategy"],
  "mgavrilenko30@dlshs.org": ["Engineering"],
  "lmil29@dlshs.org": ["Engineering", "Business & Strategy"],
  "25995@dlshs.org": ["Outreach & Ops", "Business & Strategy", "Marketing & Social"],
  "nschafer29@dlshs.org": ["Engineering", "Media & Design", "Marketing & Social"],
  "dbrosnan29@dlshs.org": ["Business & Strategy", "Outreach & Ops", "Media & Design"],
  "ibaker28@carondeleths.org": ["Business & Strategy"],
  "izabelbaker0@gmail.com": ["Business & Strategy"],
  "ggeronimo30@dlshs.org": ["Marketing & Social"],
  "25872@dlshs.org": ["Engineering", "Business & Strategy"],
  "wbusselle29@dlshs.org": ["Marketing & Social", "Engineering", "Media & Design"],
  "25865@dlshs.org": ["Media & Design"],
  "26029@dlshs.org": ["Marketing & Social", "Media & Design"],
  "26050@dlshs.org": ["Business & Strategy", "Engineering"],
};

/** Finds or creates each form role, returning a name → id map. */
export async function ensureFormRoles(ctx: MutationCtx, names: Iterable<string>) {
  const existing = await ctx.db.query("roles").collect();
  const byName = new Map(existing.map((role) => [role.name.toLowerCase(), role._id]));
  const ids = new Map<string, Id<"roles">>();
  for (const name of new Set(names)) {
    let id = byName.get(name.toLowerCase());
    if (!id) {
      id = await ctx.db.insert("roles", { name, color: FORM_ROLES[name] ?? "sky" });
      byName.set(name.toLowerCase(), id);
    }
    ids.set(name, id);
  }
  return ids;
}

/** Adds the form roles for this user's email (if listed). Returns whether anything changed. */
export async function applyFormRoles(ctx: MutationCtx, user: Doc<"users">) {
  const wanted = FORM_ASSIGNMENTS[user.email.toLowerCase()];
  if (!wanted) return false;
  const ids = await ensureFormRoles(ctx, wanted);
  const roleIds = [...user.roleIds];
  for (const name of wanted) {
    const id = ids.get(name)!;
    if (!roleIds.includes(id)) roleIds.push(id);
  }
  if (roleIds.length === user.roleIds.length) return false;
  await ctx.db.patch(user._id, { roleIds });
  return true;
}
