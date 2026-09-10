import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { columnColor } from "./schema";
import { requireCardEditor, requireMember } from "./access";
import { displayName, logEvent } from "./history";

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
    const withFiles = await Promise.all(
      cards
        .sort((a, b) => a.order - b.order)
        .map(async (card) => ({
          ...card,
          files: await Promise.all(
            (card.attachments ?? []).map(async (a) => ({
              ...a,
              url: await ctx.storage.getUrl(a.storageId),
            })),
          ),
        })),
    );
    return { columns, cards: withFiles, badges };
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
    const identity = await requireMember(ctx);
    const last = await ctx.db.query("columns").withIndex("by_order").order("desc").first();
    const name = title.trim() || "Untitled";
    const columnId = await ctx.db.insert("columns", {
      title: name,
      color,
      order: (last?.order ?? -1) + 1,
    });
    await logEvent(ctx, identity, {
      kind: "column_created",
      summary: `${displayName(identity)} created column "${name}"`,
      targetKind: "column",
      after: name,
      columnId,
    });
  },
});

export const renameColumn = mutation({
  args: { columnId: v.id("columns"), title: v.string() },
  handler: async (ctx, { columnId, title }) => {
    const identity = await requireMember(ctx);
    const column = await ctx.db.get(columnId);
    const name = title.trim() || "Untitled";
    if (!column || column.title === name) return;
    await ctx.db.patch(columnId, { title: name });
    await logEvent(ctx, identity, {
      kind: "column_renamed",
      summary: `${displayName(identity)} renamed column "${column.title}" to "${name}"`,
      targetKind: "column",
      field: "column name",
      before: column.title,
      after: name,
      columnId,
    });
  },
});

export const deleteColumn = mutation({
  args: { columnId: v.id("columns") },
  handler: async (ctx, { columnId }) => {
    const identity = await requireMember(ctx);
    const column = await ctx.db.get(columnId);
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_column_order", (q) => q.eq("columnId", columnId))
      .collect();
    for (const card of cards) {
      for (const a of card.attachments ?? []) await ctx.storage.delete(a.storageId);
      await ctx.db.delete(card._id);
    }
    await ctx.db.delete(columnId);
    if (!column) return;
    const cardList =
      cards.length === 0
        ? "it was empty"
        : `deleting ${cards.length} card${cards.length === 1 ? "" : "s"}: ${cards.map((c) => `"${c.title}"`).join(", ")}`;
    await logEvent(ctx, identity, {
      kind: "column_deleted",
      summary: `${displayName(identity)} deleted column "${column.title}" (${cardList})`,
      targetKind: "column",
      before: column.title,
      columnId,
      restoreColumn: {
        title: column.title,
        color: column.color,
        cards: cards.map((c) => ({
          title: c.title,
          description: c.description,
          createdBy: c.createdBy,
          createdByName: c.createdByName,
          createdByImage: c.createdByImage,
        })),
      },
    });
  },
});

export const addCard = mutation({
  args: { columnId: v.id("columns"), title: v.string() },
  handler: async (ctx, { columnId, title }) => {
    const identity = await requireMember(ctx);
    const column = await ctx.db.get(columnId);
    const last = await ctx.db
      .query("cards")
      .withIndex("by_column_order", (q) => q.eq("columnId", columnId))
      .order("desc")
      .first();
    const name = title.trim() || "Untitled";
    const cardId = await ctx.db.insert("cards", {
      columnId,
      title: name,
      order: (last?.order ?? -1) + 1,
      createdBy: identity.subject,
      createdByName: displayName(identity),
      createdByImage: identity.pictureUrl,
    });
    await logEvent(ctx, identity, {
      kind: "card_created",
      summary: `${displayName(identity)} created card "${name}" in "${column?.title ?? "a column"}"`,
      targetKind: "card",
      after: name,
      cardId,
      columnId,
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
    const card = await ctx.db.get(cardId);
    if (!card) return;
    const identity = await requireCardEditor(ctx, card);
    const patch: { title?: string; description?: string } = {};
    if (title !== undefined) patch.title = title.trim() || "Untitled";
    if (description !== undefined) patch.description = description;
    const changedTitle = patch.title !== undefined && patch.title !== card.title;
    const changedDescription =
      patch.description !== undefined && patch.description !== (card.description ?? "");
    if (!changedTitle && !changedDescription) return;
    // Snapshot the pre-edit state so "restore this version" can revert it.
    const snapshot = {
      title: card.title,
      description: card.description,
      columnId: card.columnId,
      order: card.order,
      createdBy: card.createdBy,
      createdByName: card.createdByName,
      createdByImage: card.createdByImage,
    };
    await ctx.db.patch(cardId, patch);
    if (changedTitle) {
      await logEvent(ctx, identity, {
        kind: "card_updated",
        summary: `${displayName(identity)} edited the title of card "${patch.title}"`,
        targetKind: "card",
        field: "title",
        before: card.title,
        after: patch.title,
        cardId,
        columnId: card.columnId,
        restoreCard: snapshot,
      });
    }
    if (changedDescription) {
      await logEvent(ctx, identity, {
        kind: "card_updated",
        summary: `${displayName(identity)} edited the details of card "${patch.title ?? card.title}"`,
        targetKind: "card",
        field: "details",
        before: card.description ?? "",
        after: patch.description ?? "",
        cardId,
        columnId: card.columnId,
        restoreCard: snapshot,
      });
    }
  },
});

export const deleteCard = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, { cardId }) => {
    const card = await ctx.db.get(cardId);
    if (!card) return;
    const identity = await requireCardEditor(ctx, card);
    const column = await ctx.db.get(card.columnId);
    for (const a of card.attachments ?? []) await ctx.storage.delete(a.storageId);
    await ctx.db.delete(cardId);
    await logEvent(ctx, identity, {
      kind: "card_deleted",
      summary: `${displayName(identity)} deleted card "${card.title}" from "${column?.title ?? "a column"}"`,
      targetKind: "card",
      field: "details",
      before: card.description ?? "",
      cardId,
      columnId: card.columnId,
      restoreCard: {
        title: card.title,
        description: card.description,
        columnId: card.columnId,
        order: card.order,
        createdBy: card.createdBy,
        createdByName: card.createdByName,
        createdByImage: card.createdByImage,
      },
    });
  },
});

/** Move a card to a column at a position index; reorders siblings. */
export const moveCard = mutation({
  args: { cardId: v.id("cards"), toColumnId: v.id("columns"), toIndex: v.number() },
  handler: async (ctx, { cardId, toColumnId, toIndex }) => {
    const card = await ctx.db.get(cardId);
    if (!card) return;
    const identity = await requireCardEditor(ctx, card);
    const fromColumnId = card.columnId;
    const fromOrder = card.order;

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

    if (fromColumnId === toColumnId && fromOrder === index) return;
    const fromColumn = await ctx.db.get(fromColumnId);
    const toColumn = await ctx.db.get(toColumnId);
    await logEvent(ctx, identity, {
      kind: "card_moved",
      summary:
        fromColumnId === toColumnId
          ? `${displayName(identity)} reordered card "${card.title}" in "${toColumn?.title ?? "a column"}"`
          : `${displayName(identity)} moved card "${card.title}" from "${fromColumn?.title ?? "a column"}" to "${toColumn?.title ?? "a column"}"`,
      targetKind: "card",
      before: fromColumn?.title,
      after: toColumn?.title,
      cardId,
      columnId: toColumnId,
      restoreCard: {
        title: card.title,
        description: card.description,
        columnId: fromColumnId,
        order: fromOrder,
        createdBy: card.createdBy,
        createdByName: card.createdByName,
        createdByImage: card.createdByImage,
      },
    });
  },
});

/** Step 1 of an upload: the client POSTs the file to this URL and gets a storageId back. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2: link the uploaded file to a card. */
export const addAttachment = mutation({
  args: {
    cardId: v.id("cards"),
    storageId: v.id("_storage"),
    name: v.string(),
    type: v.string(),
    size: v.number(),
  },
  handler: async (ctx, { cardId, ...file }) => {
    const card = await ctx.db.get(cardId);
    if (!card) {
      await ctx.storage.delete(file.storageId);
      return;
    }
    const identity = await requireCardEditor(ctx, card);
    await ctx.db.patch(cardId, { attachments: [...(card.attachments ?? []), file] });
    await logEvent(ctx, identity, {
      kind: "attachment_added",
      summary: `${displayName(identity)} attached "${file.name}" to card "${card.title}"`,
      targetKind: "attachment",
      after: file.name,
      cardId,
      columnId: card.columnId,
    });
  },
});

export const removeAttachment = mutation({
  args: { cardId: v.id("cards"), storageId: v.id("_storage") },
  handler: async (ctx, { cardId, storageId }) => {
    const card = await ctx.db.get(cardId);
    if (!card) return;
    const identity = await requireCardEditor(ctx, card);
    const removed = (card.attachments ?? []).find((a) => a.storageId === storageId);
    await ctx.db.patch(cardId, {
      attachments: (card.attachments ?? []).filter((a) => a.storageId !== storageId),
    });
    await ctx.storage.delete(storageId);
    await logEvent(ctx, identity, {
      kind: "attachment_removed",
      summary: `${displayName(identity)} removed "${removed?.name ?? "an attachment"}" from card "${card.title}"`,
      targetKind: "attachment",
      before: removed?.name ?? "",
      cardId,
      columnId: card.columnId,
    });
  },
});
