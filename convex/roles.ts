import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { columnColor } from "./schema";
import { isTeacherEmail, requireMember, requireTeacher } from "./access";

/** Upsert the signed-in user so teachers can assign them roles. Called on dashboard load. */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireMember(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    const profile = {
      email: identity.email!.toLowerCase(),
      name: identity.name ?? identity.email!,
      image: identity.pictureUrl,
      lastSeen: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, profile);
    } else {
      await ctx.db.insert("users", { clerkId: identity.subject, roleIds: [], ...profile });
    }
  },
});

/** Whether the caller may open the Teacher view. */
export const amTeacher = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return isTeacherEmail(identity?.email);
  },
});

/** Roles plus every signed-in user. Teacher only. */
export const adminView = query({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const roles = await ctx.db.query("roles").collect();
    const users = await ctx.db.query("users").collect();
    return {
      roles,
      users: users.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export const createRole = mutation({
  args: { name: v.string(), color: columnColor },
  handler: async (ctx, { name, color }) => {
    await requireTeacher(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Role needs a name");
    await ctx.db.insert("roles", { name: trimmed, color });
  },
});

export const updateRole = mutation({
  args: { roleId: v.id("roles"), name: v.optional(v.string()), color: v.optional(columnColor) },
  handler: async (ctx, { roleId, name, color }) => {
    await requireTeacher(ctx);
    const patch: { name?: string; color?: typeof color } = {};
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (color !== undefined) patch.color = color;
    await ctx.db.patch(roleId, patch);
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    await requireTeacher(ctx);
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.roleIds.includes(roleId)) {
        await ctx.db.patch(user._id, { roleIds: user.roleIds.filter((r) => r !== roleId) });
      }
    }
    await ctx.db.delete(roleId);
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), roleId: v.id("roles"), assigned: v.boolean() },
  handler: async (ctx, { userId, roleId, assigned }) => {
    await requireTeacher(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    const has = user.roleIds.includes(roleId);
    if (assigned && !has) {
      await ctx.db.patch(userId, { roleIds: [...user.roleIds, roleId] });
    } else if (!assigned && has) {
      await ctx.db.patch(userId, { roleIds: user.roleIds.filter((r) => r !== roleId) });
    }
  },
});
