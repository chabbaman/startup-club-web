import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const columnColor = v.union(
  v.literal("coral"),
  v.literal("amber"),
  v.literal("lime"),
  v.literal("teal"),
  v.literal("sky"),
  v.literal("violet"),
  v.literal("pink"),
);

export default defineSchema({
  columns: defineTable({
    title: v.string(),
    color: columnColor,
    order: v.number(),
  }).index("by_order", ["order"]),

  cards: defineTable({
    columnId: v.id("columns"),
    title: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    createdBy: v.string(),
    createdByName: v.string(),
    createdByImage: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          type: v.string(),
          size: v.number(),
        }),
      ),
    ),
  }).index("by_column_order", ["columnId", "order"]),

  // Everyone who has opened the dashboard at least once.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    roleIds: v.array(v.id("roles")),
    lastSeen: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  roles: defineTable({
    name: v.string(),
    color: columnColor,
  }),

  // Append-only audit log of board activity, shown in the teacher view.
  history: defineTable({
    at: v.number(),
    actorClerkId: v.string(),
    actorName: v.string(),
    actorEmail: v.string(),
    actorImage: v.optional(v.string()),
    kind: v.union(
      v.literal("card_created"),
      v.literal("card_updated"),
      v.literal("card_moved"),
      v.literal("card_deleted"),
      v.literal("column_created"),
      v.literal("column_renamed"),
      v.literal("column_deleted"),
      v.literal("attachment_added"),
      v.literal("attachment_removed"),
    ),
    // Human-readable one-liner, e.g. 'Maya deleted card "Fundraiser" from Ideas'.
    summary: v.string(),
    targetKind: v.union(v.literal("card"), v.literal("column"), v.literal("attachment")),
    // Text that changed: new text for creations, old text for deletions,
    // old -> new for edits. Shown verbatim so teachers see what was written.
    field: v.optional(v.string()),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    // IDs of the affected docs (dead for deletions, but harmless).
    cardId: v.optional(v.id("cards")),
    columnId: v.optional(v.id("columns")),
    // Snapshot used by the "restore this version" button. For card events it
    // holds the card's state *before* the change (so updating reverts it,
    // deleting recreates it, moving moves it back). Attachments (files) are
    // not restorable because their storage blobs are deleted.
    restoreCard: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        columnId: v.id("columns"),
        order: v.number(),
        createdBy: v.string(),
        createdByName: v.string(),
        createdByImage: v.optional(v.string()),
      }),
    ),
    // Snapshot used to recreate a deleted column with its cards.
    restoreColumn: v.optional(
      v.object({
        title: v.string(),
        color: columnColor,
        cards: v.array(
          v.object({
            title: v.string(),
            description: v.optional(v.string()),
            createdBy: v.string(),
            createdByName: v.string(),
            createdByImage: v.optional(v.string()),
          }),
        ),
      }),
    ),
  }).index("by_at", ["at"]),
});
