import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isTeacherEmail, requireMember } from "./access";
import { displayName } from "./history";

const MAX_LENGTH = 2000;

function canEditMessage(
  identity: { subject: string; email?: string },
  message: { createdBy: string },
): boolean {
  return message.createdBy === identity.subject || isTeacherEmail(identity.email);
}

/** Thread for one card, oldest first, with quoted parent resolved. */
export const list = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, { cardId }) => {
    await requireMember(ctx);
    const card = await ctx.db.get(cardId);
    if (!card) return [];
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_card", (q) => q.eq("cardId", cardId))
      .collect();
    messages.sort((a, b) => a._creationTime - b._creationTime);
    const byId = new Map(messages.map((m) => [m._id, m]));
    return messages.map((m) => {
      const parent = m.replyToId ? byId.get(m.replyToId) : undefined;
      return {
        ...m,
        replyTo: parent
          ? { _id: parent._id, text: parent.text, createdByName: parent.createdByName }
          : m.replyToId
            ? { _id: m.replyToId, text: "", createdByName: "", deleted: true as const }
            : undefined,
      };
    });
  },
});

export const add = mutation({
  args: {
    cardId: v.id("cards"),
    text: v.string(),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, { cardId, text, replyToId }) => {
    const identity = await requireMember(ctx);
    const card = await ctx.db.get(cardId);
    if (!card) throw new Error("That card no longer exists");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Reply needs some text");
    if (trimmed.length > MAX_LENGTH) throw new Error(`Replies are limited to ${MAX_LENGTH} characters`);
    if (replyToId) {
      const parent = await ctx.db.get(replyToId);
      if (!parent || parent.cardId !== cardId) {
        throw new Error("The message you're replying to no longer exists");
      }
    }
    await ctx.db.insert("messages", {
      cardId,
      text: trimmed,
      replyToId,
      createdBy: identity.subject,
      createdByName: displayName(identity),
      createdByImage: identity.pictureUrl,
    });
  },
});

export const update = mutation({
  args: { messageId: v.id("messages"), text: v.string() },
  handler: async (ctx, { messageId, text }) => {
    const identity = await requireMember(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) return;
    if (!canEditMessage(identity, message)) {
      throw new Error("Only the person who wrote this reply (or a teacher) can edit it");
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed === message.text) return;
    if (trimmed.length > MAX_LENGTH) throw new Error(`Replies are limited to ${MAX_LENGTH} characters`);
    await ctx.db.patch(messageId, { text: trimmed });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const identity = await requireMember(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) return;
    if (!canEditMessage(identity, message)) {
      throw new Error("Only the person who wrote this reply (or a teacher) can delete it");
    }
    await ctx.db.delete(messageId);
  },
});
