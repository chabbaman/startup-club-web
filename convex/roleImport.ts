import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

/**
 * Role assignments from the fall 2026 signup form, keyed by the email each
 * member gave. Names refer to the club's existing roles; nothing is created.
 * Applied by `roles.ensureUser` the first time a listed member signs in, and
 * by `reassignFormRoles` for everyone already signed in.
 */
export const FORM_ASSIGNMENTS: Record<string, string[]> = {
  "echeng28@dlshs.org": ["3d Art & Cad"],
  "25867@dlshs.org": ["Social Media & Photography"],
  "26008@dlshs.org": ["Programming"],
  "25925@dlshs.org": ["Programming"],
  "nashley29@dlshs.org": ["Marketing & Video"],
  "rtancuan@gmail.com": ["Business & Sales"],
  "25961@dlshs.org": ["Programming"],
  "lchang29@dlshs.org": ["2d Art and Design"],
  "26002@dlshs.org": ["Business & Sales"],
  "anosrati30@dlshs.org": ["Marketing & Video"],
  "25829@dlshs.org": ["Product & QA"],
  "25942@dlshs.org": ["3d Art & Cad"],
  "25877@dlshs.org": ["Business & Sales"],
  "25923@dlshs.org": ["Marketing & Video"],
  "atang28@dlshs.org": ["Social Media & Photography"],
  "25855@dlshs.org": ["3d Art & Cad"],
  "aaguilar29@dlshs.org": ["Social Media & Photography"],
  "wfoster29@dlshs.org": ["Business & Sales"],
  "mgavrilenko30@dlshs.org": ["Product & QA"],
  "rnelson30@dlshs.org": ["Product & QA"],
  "lmil29@dlshs.org": ["Programming"],
  "25995@dlshs.org": ["Marketing & Video"],
  "nschafer29@dlshs.org": ["Product & QA"],
  "dbrosnan29@dlshs.org": ["Business & Sales"],
  "ibaker28@carondeleths.org": ["Product & QA"],
  "izabelbaker0@gmail.com": ["Product & QA"],
  "ggeronimo30@dlshs.org": ["Marketing & Video"],
  "25872@dlshs.org": ["Product & QA"],
  "wbusselle29@dlshs.org": ["Marketing & Video"],
  "25865@dlshs.org": ["Marketing & Video"],
  "26029@dlshs.org": ["Marketing & Video"],
  "26050@dlshs.org": ["Business & Sales"],
};

/** Roles the first (since reverted) import created; removed by `reassignFormRoles`. */
const IMPORTED_ROLES = ["Engineering", "Marketing & Social", "Media & Design", "Business & Strategy", "Outreach & Ops"];

/** Adds the form roles for this user's email (if listed and the roles exist). Returns whether anything changed. */
export async function applyFormRoles(ctx: MutationCtx, user: Doc<"users">) {
  const wanted = FORM_ASSIGNMENTS[user.email.toLowerCase()];
  if (!wanted) return false;
  const roles = await ctx.db.query("roles").collect();
  const byName = new Map(roles.map((role) => [role.name.toLowerCase(), role._id]));
  const roleIds = [...user.roleIds];
  for (const name of wanted) {
    const id = byName.get(name.toLowerCase());
    if (id && !roleIds.includes(id)) roleIds.push(id);
  }
  if (roleIds.length === user.roleIds.length) return false;
  await ctx.db.patch(user._id, { roleIds });
  return true;
}

/**
 * One-off cleanup, run from the CLI: deletes the roles the old import created
 * (unassigning them everywhere) and applies the form assignments above to
 * every signed-in member. Idempotent.
 *
 *   npx convex run roleImport:reassignFormRoles --prod
 */
export const reassignFormRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").collect();
    const doomed = roles.filter((role) => IMPORTED_ROLES.includes(role.name)).map((role) => role._id);
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.roleIds.some((id) => doomed.includes(id))) {
        await ctx.db.patch(user._id, { roleIds: user.roleIds.filter((id) => !doomed.includes(id)) });
      }
    }
    for (const id of doomed) await ctx.db.delete(id);

    let updated = 0;
    const seen = new Set<string>();
    for (const user of await ctx.db.query("users").collect()) {
      const email = user.email.toLowerCase();
      if (email in FORM_ASSIGNMENTS) seen.add(email);
      if (await applyFormRoles(ctx, user)) updated += 1;
    }
    const stillEmpty = (await ctx.db.query("users").collect())
      .filter((user) => user.roleIds.length === 0)
      .map((user) => `${user.name} <${user.email}>`);
    const pending = Object.keys(FORM_ASSIGNMENTS).filter((email) => !seen.has(email));
    return { deletedRoles: doomed.length, updated, stillEmpty, pending };
  },
});
