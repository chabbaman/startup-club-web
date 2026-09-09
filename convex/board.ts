import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { columnColor } from "./schema";
import { requireMember } from "./access";

const DEFAULT_COLUMNS: { title: string; color: "coral" | "amber" | "teal" | "violet" }[] = [
  { title: "Ideas", color: "violet" },
  { title: "To Do", color: "coral" },
  { title: "In Progress", color: "amber" },
  { title: "Done", color: "teal" },
];

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const columns = await ctx.db.query("columns").withIndex("by_order").collect();
    const cards = await ctx.db.query("cards").collect();
    const roles = await ctx.db.query("roles").collect();
    const users = await ctx.db.query("users").collect();
    const roleById = new Map(roles.map((r) => [r._id, r]));
    // clerkId -> roles, so cards can show badges next to the creator's name.
    const badges: Record<string, { name: string; color: (typeof roles)[number]["color"] }[]> = {};
    for (const user of users) {
      badges[user.clerkId] = user.roleIds
        .map((id) => roleById.get(id))
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
        .map((r) => ({ name: r.name, color: r.color }));
    }
    return {
      columns,
      cards: cards.sort((a, b) => a.order - b.order),
      badges,
    };
  },
});

export const seedIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const existing = await ctx.db.query("columns").first();
    if (existing) return;
    for (const [i, col] of DEFAULT_COLUMNS.entries()) {
      await ctx.db.insert("columns", { ...col, order: i });
    }
  },
});

export const addColumn = mutation({
  args: { title: v.string(), color: columnColor },
  handler: async (ctx, { title, color }) => {
    await requireMember(ctx);
    const last = await ctx.db.query("columns").withIndex("by_order").order("desc").first();
    await ctx.db.insert("columns", {
      title: title.trim() || "Untitled",
      color,
      order: (last?.order ?? -1) + 1,
    });
  },
});

export const renameColumn = mutation({
  args: { columnId: v.id("columns"), title: v.string() },
  handler: async (ctx, { columnId, title }) => {
    await requireMember(ctx);
    await ctx.db.patch(columnId, { title: title.trim() || "Untitled" });
  },
});

export const deleteColumn = mutation({
  args: { columnId: v.id("columns") },
  handler: async (ctx, { columnId }) => {
    await requireMember(ctx);
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_column_order", (q) => q.eq("columnId", columnId))
      .collect();
    for (const card of cards) await ctx.db.delete(card._id);
    await ctx.db.delete(columnId);
  },
});

export const addCard = mutation({
  args: { columnId: v.id("columns"), title: v.string() },
  handler: async (ctx, { columnId, title }) => {
    const identity = await requireMember(ctx);
    const last = await ctx.db
      .query("cards")
      .withIndex("by_column_order", (q) => q.eq("columnId", columnId))
      .order("desc")
      .first();
    await ctx.db.insert("cards", {
      columnId,
      title: title.trim() || "Untitled",
      order: (last?.order ?? -1) + 1,
      createdBy: identity.subject,
      createdByName: identity.name ?? identity.email ?? "Someone",
      createdByImage: identity.pictureUrl,
    });
  },
});

export const updateCard = mutation({
  args: {
    cardId: v.id("cards"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { cardId, title, description }) => {
    await requireMember(ctx);
    const patch: { title?: string; description?: string } = {};
    if (title !== undefined) patch.title = title.trim() || "Untitled";
    if (description !== undefined) patch.description = description;
    await ctx.db.patch(cardId, patch);
  },
});

export const deleteCard = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, { cardId }) => {
    await requireMember(ctx);
    await ctx.db.delete(cardId);
  },
});

/** Move a card to a column at a position index; reorders siblings. */
export const moveCard = mutation({
  args: { cardId: v.id("cards"), toColumnId: v.id("columns"), toIndex: v.number() },
  handler: async (ctx, { cardId, toColumnId, toIndex }) => {
    await requireMember(ctx);
    const card = await ctx.db.get(cardId);
    if (!card) return;

    const siblings = (
      await ctx.db
        .query("cards")
        .withIndex("by_column_order", (q) => q.eq("columnId", toColumnId))
        .collect()
    ).filter((c) => c._id !== cardId);

    const index = Math.max(0, Math.min(toIndex, siblings.length));
    siblings.splice(index, 0, card);

    for (const [i, c] of siblings.entries()) {
      if (c._id === cardId) {
        await ctx.db.patch(cardId, { columnId: toColumnId, order: i });
      } else if (c.order !== i) {
        await ctx.db.patch(c._id, { order: i });
      }
    }
  },
});
