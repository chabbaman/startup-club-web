/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js", "!../convex/**/*.d.ts"]);
const teacherIdentity = { subject: "teacher", email: "thomasg@dlshs.org" };
const memberIdentity = { subject: "member", email: "member@dlshs.org" };
const otherIdentity = { subject: "other", email: "other@carondeleths.org" };
const draft = { question: "What should we build?", options: ["An app", "A website"] };

function setup() {
  const t = convexTest(schema, modules);
  return { t, teacher: t.withIdentity(teacherIdentity), member: t.withIdentity(memberIdentity), other: t.withIdentity(otherIdentity) };
}

describe("polls", () => {
  test("publishes to members, hides results even from the creator, and reveals live tallies only to voters", async () => {
    const { teacher, member, other } = setup();
    const pollId = await teacher.mutation(api.polls.create, draft);
    for (const viewer of [teacher, member, other]) {
      const [poll] = await viewer.query(api.polls.list);
      expect(poll).toEqual({ _id: pollId, ...draft, closed: false, myVote: null, results: null });
    }
    await member.mutation(api.polls.vote, { pollId, optionIndex: 0 });
    expect((await member.query(api.polls.list))[0]).toMatchObject({ myVote: 0, results: { counts: [1, 0], total: 1 } });
    expect((await other.query(api.polls.list))[0].results).toBeNull();
    expect((await teacher.query(api.polls.list))[0].results).toBeNull();
    await other.mutation(api.polls.vote, { pollId, optionIndex: 1 });
    expect((await member.query(api.polls.list))[0].results).toEqual({ counts: [1, 1], total: 2 });
    // A new session for the same account still has the original vote.
    await expect(member.mutation(api.polls.vote, { pollId, optionIndex: 1 })).rejects.toThrow("already voted");
    expect((await member.query(api.polls.list))[0].results?.total).toBe(2);
  });

  test("requires membership to read/vote and teacher access to publish/close", async () => {
    const { t, teacher, member } = setup();
    const outsider = t.withIdentity({ subject: "outsider", email: "outsider@example.com" });
    const pollId = await teacher.mutation(api.polls.create, draft);
    for (const viewer of [t, outsider]) {
      await expect(viewer.query(api.polls.list)).rejects.toThrow();
      await expect(viewer.mutation(api.polls.vote, { pollId, optionIndex: 0 })).rejects.toThrow();
      await expect(viewer.mutation(api.polls.create, draft)).rejects.toThrow();
      await expect(viewer.mutation(api.polls.close, { pollId })).rejects.toThrow();
    }
    await expect(member.mutation(api.polls.create, draft)).rejects.toThrow();
    await expect(member.mutation(api.polls.close, { pollId })).rejects.toThrow();
  });

  test("closing stops voting and preserves results for previous voters without revealing them to nonvoters", async () => {
    const { teacher, member, other } = setup();
    const pollId = await teacher.mutation(api.polls.create, draft);
    await member.mutation(api.polls.vote, { pollId, optionIndex: 1 });
    await teacher.mutation(api.polls.close, { pollId });
    await expect(other.mutation(api.polls.vote, { pollId, optionIndex: 0 })).rejects.toThrow("closed");
    expect((await member.query(api.polls.list))[0]).toMatchObject({ closed: true, results: { counts: [0, 1], total: 1 } });
    expect((await other.query(api.polls.list))[0].results).toBeNull();
  });

  test("validates questions and choices on the server", async () => {
    const { teacher } = setup();
    for (const invalid of [
      { ...draft, question: " " },
      { ...draft, question: "q".repeat(281) },
      { ...draft, options: ["one"] },
      { ...draft, options: ["1", "2", "3", "4", "5"] },
      { ...draft, options: [" ", "two"] },
      { ...draft, options: ["Same", " same "] },
      { ...draft, options: ["x".repeat(81), "two"] },
    ]) await expect(teacher.mutation(api.polls.create, invalid)).rejects.toThrow();
    expect(await teacher.query(api.polls.list)).toEqual([]);
    await teacher.mutation(api.polls.create, { question: " Question? ", options: [" one ", " two ", "three", "four"] });
    expect((await teacher.query(api.polls.list))[0]).toMatchObject({ question: "Question?", options: ["one", "two", "three", "four"] });
  });

  test("rejects invalid choices without consuming the member's vote", async () => {
    const { teacher, member } = setup();
    const pollId = await teacher.mutation(api.polls.create, draft);
    for (const optionIndex of [-1, 2, 0.5, NaN, Infinity]) {
      await expect(member.mutation(api.polls.vote, { pollId, optionIndex })).rejects.toThrow("valid poll option");
    }
    await member.mutation(api.polls.vote, { pollId, optionIndex: 0 });
    expect((await member.query(api.polls.list))[0].results).toEqual({ counts: [1, 0], total: 1 });
  });

  test("simultaneous duplicate votes count once and different voters retain both votes", async () => {
    const { teacher, member, other } = setup();
    const pollId = await teacher.mutation(api.polls.create, draft);
    const attempts = await Promise.allSettled([
      member.mutation(api.polls.vote, { pollId, optionIndex: 0 }),
      member.mutation(api.polls.vote, { pollId, optionIndex: 1 }),
      other.mutation(api.polls.vote, { pollId, optionIndex: 1 }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(2);
    expect((await member.query(api.polls.list))[0].results?.total).toBe(2);
  });
});
