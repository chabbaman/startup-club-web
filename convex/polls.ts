import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember, requireTeacher } from "./access";

/** Results never leave the server until this member has voted. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireMember(ctx);
    const [open, closed] = await Promise.all([
      ctx.db.query("polls").withIndex("by_closed", (q) => q.eq("closed", false)).order("desc").collect(),
      ctx.db.query("polls").withIndex("by_closed", (q) => q.eq("closed", true)).order("desc").take(10),
    ]);
    return await Promise.all([...open, ...closed].map(async (poll) => {
      const vote = await ctx.db.query("pollVotes")
        .withIndex("by_poll_voter", (q) => q.eq("pollId", poll._id).eq("voterId", identity.subject))
        .unique();
      return {
        _id: poll._id,
        question: poll.question,
        options: poll.options,
        closed: poll.closed,
        myVote: vote?.optionIndex ?? null,
        results: vote ? {
          counts: poll.counts,
          total: poll.counts.reduce((sum, count) => sum + count, 0),
        } : null,
      };
    }));
  },
});

export const create = mutation({
  args: { question: v.string(), options: v.array(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireTeacher(ctx);
    const question = args.question.trim();
    const options = args.options.map((option) => option.trim());
    if (!question || question.length > 280) {
      throw new ConvexError("Use a question between 1 and 280 characters.");
    }
    if (options.length < 2 || options.length > 4 || options.some((option) => !option || option.length > 80)) {
      throw new ConvexError("Add 2–4 choices, each between 1 and 80 characters.");
    }
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
      throw new ConvexError("Each choice must be different.");
    }
    return await ctx.db.insert("polls", {
      question, options, counts: options.map(() => 0), createdBy: identity.subject, closed: false,
    });
  },
});

export const vote = mutation({
  args: { pollId: v.id("polls"), optionIndex: v.number() },
  handler: async (ctx, { pollId, optionIndex }) => {
    const identity = await requireMember(ctx);
    const poll = await ctx.db.get(pollId);
    if (!poll) throw new ConvexError("This poll is no longer available.");
    if (poll.closed) throw new ConvexError("Voting has closed for this poll.");
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new ConvexError("Choose a valid poll option.");
    }
    const existing = await ctx.db.query("pollVotes")
      .withIndex("by_poll_voter", (q) => q.eq("pollId", pollId).eq("voterId", identity.subject))
      .unique();
    if (existing) throw new ConvexError("You have already voted in this poll.");
    // The uniqueness check, vote, and count update share one atomic transaction.
    await ctx.db.insert("pollVotes", { pollId, voterId: identity.subject, optionIndex });
    const counts = [...poll.counts];
    counts[optionIndex] += 1;
    await ctx.db.patch(pollId, { counts });
  },
});

export const close = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, { pollId }) => {
    await requireTeacher(ctx);
    const poll = await ctx.db.get(pollId);
    if (!poll) throw new ConvexError("This poll is no longer available.");
    await ctx.db.patch(pollId, { closed: true });
  },
});
