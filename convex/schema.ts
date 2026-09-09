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
});
