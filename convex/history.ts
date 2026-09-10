import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { UserIdentity } from "convex/server";
import { v } from "convex/values";
import { requireTeacher } from "./access";

const HISTORY_LIMIT = 200;

export type HistoryKind =
  | "card_created"
  | "card_updated"
  | "card_moved"
  | "card_deleted"
  | "column_created"
  | "column_renamed"
  | "column_deleted"
  | "attachment_added"
  | "attachment_removed";

export type CardSnapshot = {
  title: string;
  description?: string;
  columnId: Id<"columns">;
  order: number;
  createdBy: string;
  createdByName: string;
  createdByImage?: string;
};

export type HistoryEvent = {
  kind: HistoryKind;
  summary: string;
  targetKind: "card" | "column" | "attachment";
  field?: string;
  before?: string;
  after?: string;
  cardId?: Id<"cards">;
  columnId?: Id<"columns">;
  restoreCard?: CardSnapshot;
  restoreColumn?: {
    title: string;
    color: "coral" | "amber" | "lime" | "teal" | "sky" | "violet" | "pink";
    cards: Omit<CardSnapshot, "columnId" | "order">[];
  };
};

/** "Maya Patel" / email fallback for summaries and restore entries. */
export function displayName(identity: UserIdentity): string {
  return identity.name ?? identity.email ?? "Someone";
}

/** Append one entry to the audit log. Called from board mutations. */
export async function logEvent(
  ctx: MutationCtx,
  identity: UserIdentity,
  event: HistoryEvent,
) {
  await ctx.db.insert("history", {
    at: Date.now(),
    actorClerkId: identity.subject,
    actorName: identity.name ?? identity.email ?? "Someone",
    actorEmail: identity.email ?? "",
    actorImage: identity.pictureUrl,
    ...event,
  });
}

/** Whether an entry carries enough of a snapshot to offer "restore this version". */
function canRestoreKind(kind: HistoryEvent["kind"]): boolean {
  return (
    kind === "card_updated" ||
    kind === "card_moved" ||
    kind === "card_deleted" ||
    kind === "column_renamed" ||
    kind === "column_deleted"
  );
}

/** The teacher-view timeline, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const entries = await ctx.db
      .query("history")
      .withIndex("by_at")
      .order("desc")
      .take(HISTORY_LIMIT);
    return entries.map((e) => ({
      ...e,
      // Column renames restore from `before` + `columnId`; everything else
      // restores from a snapshot.
      canRestore:
        (canRestoreKind(e.kind) &&
          (e.restoreCard !== undefined || e.restoreColumn !== undefined)) ||
        (e.kind === "column_renamed" && e.columnId !== undefined && e.before !== undefined),
    }));
  },
});

/**
 * Teacher-only "restore this version": puts the affected card/column back to
 * the state captured in the entry, then logs the restore as a new entry.
 */
export const restore = mutation({
  args: { entryId: v.id("history") },
  handler: async (ctx, { entryId }) => {
    const identity = await requireTeacher(ctx);
    const entry = await ctx.db.get(entryId);
    if (!entry) throw new Error("History entry not found");

    switch (entry.kind) {
      case "card_updated": {
        if (!entry.cardId || !entry.restoreCard) throw new Error("Nothing to restore");
        const card = await ctx.db.get(entry.cardId);
        if (!card) throw new Error("That card no longer exists");
        await ctx.db.patch(entry.cardId, {
          title: entry.restoreCard.title,
          description: entry.restoreCard.description,
        });
        await logEvent(ctx, identity, {
          kind: "card_updated",
          summary: `${displayName(identity)} restored card "${entry.restoreCard.title}" to an earlier version`,
          targetKind: "card",
          cardId: entry.cardId,
        });
        return;
      }
      case "card_moved": {
        if (!entry.cardId || !entry.restoreCard) throw new Error("Nothing to restore");
        const card = await ctx.db.get(entry.cardId);
        if (!card) throw new Error("That card no longer exists");
        const backTo = await ctx.db.get(entry.restoreCard.columnId);
        if (!backTo) throw new Error("The original column no longer exists");
        await moveCardTo(ctx, entry.cardId, entry.restoreCard.columnId, entry.restoreCard.order);
        await logEvent(ctx, identity, {
          kind: "card_moved",
          summary: `${displayName(identity)} moved card "${card.title}" back to "${backTo.title}"`,
          targetKind: "card",
          cardId: entry.cardId,
        });
        return;
      }
      case "card_deleted": {
        if (!entry.restoreCard) throw new Error("Nothing to restore");
        const snap = entry.restoreCard;
        const column =
          (await ctx.db.get(snap.columnId)) ??
          (await ctx.db.query("columns").withIndex("by_order").first());
        if (!column) throw new Error("There is no column to restore the card into");
        const last = await ctx.db
          .query("cards")
          .withIndex("by_column_order", (q) => q.eq("columnId", column._id))
          .order("desc")
          .first();
        const cardId = await ctx.db.insert("cards", {
          columnId: column._id,
          title: snap.title,
          description: snap.description,
          order: (last?.order ?? -1) + 1,
          createdBy: snap.createdBy,
          createdByName: snap.createdByName,
          createdByImage: snap.createdByImage,
        });
        await logEvent(ctx, identity, {
          kind: "card_created",
          summary: `${displayName(identity)} restored deleted card "${snap.title}" into "${column.title}"`,
          targetKind: "card",
          after: snap.title,
          cardId,
          columnId: column._id,
        });
        return;
      }
      case "column_renamed": {
        if (!entry.columnId || entry.before === undefined) throw new Error("Nothing to restore");
        const column = await ctx.db.get(entry.columnId);
        if (!column) throw new Error("That column no longer exists");
        await ctx.db.patch(entry.columnId, { title: entry.before });
        await logEvent(ctx, identity, {
          kind: "column_renamed",
          summary: `${displayName(identity)} renamed column back to "${entry.before}"`,
          targetKind: "column",
          field: "column name",
          before: column.title,
          after: entry.before,
          columnId: entry.columnId,
        });
        return;
      }
      case "column_deleted": {
        if (!entry.restoreColumn) throw new Error("Nothing to restore");
        const snap = entry.restoreColumn;
        const last = await ctx.db.query("columns").withIndex("by_order").order("desc").first();
        const columnId = await ctx.db.insert("columns", {
          title: snap.title,
          color: snap.color,
          order: (last?.order ?? -1) + 1,
        });
        for (const [i, c] of snap.cards.entries()) {
          await ctx.db.insert("cards", {
            columnId,
            title: c.title,
            description: c.description,
            order: i,
            createdBy: c.createdBy,
            createdByName: c.createdByName,
            createdByImage: c.createdByImage,
          });
        }
        await logEvent(ctx, identity, {
          kind: "column_created",
          summary: `${displayName(identity)} restored deleted column "${snap.title}" with ${snap.cards.length} card${snap.cards.length === 1 ? "" : "s"}`,
          targetKind: "column",
          after: snap.title,
          columnId,
        });
        return;
      }
      default:
        throw new Error("This kind of entry cannot be restored");
    }
  },
});

/** Same reorder logic as board.moveCard: place a card at an index in a column. */
async function moveCardTo(
  ctx: MutationCtx,
  cardId: Id<"cards">,
  toColumnId: Id<"columns">,
  toIndex: number,
) {
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
}
