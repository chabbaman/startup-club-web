/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { FORM_ASSIGNMENTS } from "../convex/roleImport";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js", "!../convex/**/*.d.ts"]);
const teacher = { subject: "teacher", email: "thomasg@dlshs.org", name: "Teacher" };
const listed = { subject: "eric", email: "echeng28@dlshs.org", name: "Eric Cheng" };
const unlisted = { subject: "someone", email: "someone@dlshs.org", name: "Someone" };

describe("signup form role import", () => {
  test("assigns form roles on first sign-in and via the teacher import, without duplicating roles", async () => {
    const t = convexTest(schema, modules);
    const asTeacher = t.withIdentity(teacher);
    await t.withIdentity(unlisted).mutation(api.roles.ensureUser, {});
    await t.withIdentity(listed).mutation(api.roles.ensureUser, {});

    let view = await asTeacher.query(api.roles.adminView);
    const eric = view.users.find((u) => u.email === listed.email)!;
    const ericRoles = view.roles.filter((r) => eric.roleIds.includes(r._id)).map((r) => r.name).sort();
    expect(ericRoles).toEqual([...FORM_ASSIGNMENTS[listed.email]].sort());
    expect(view.users.find((u) => u.email === unlisted.email)!.roleIds).toEqual([]);

    const result = await asTeacher.mutation(api.roles.importFormRoles, {});
    expect(result.matched).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.pending).not.toContain(listed.email);
    expect(result.pending).toContain("25867@dlshs.org");

    // Signing in again or re-importing never adds duplicate roles or role docs.
    await t.withIdentity(listed).mutation(api.roles.ensureUser, {});
    await asTeacher.mutation(api.roles.importFormRoles, {});
    view = await asTeacher.query(api.roles.adminView);
    expect(view.roles.map((r) => r.name).sort()).toEqual([...new Set(FORM_ASSIGNMENTS[listed.email])].sort());
    expect(view.users.find((u) => u.email === listed.email)!.roleIds).toHaveLength(FORM_ASSIGNMENTS[listed.email].length);
  });

  test("only teachers can import", async () => {
    const t = convexTest(schema, modules);
    await expect(t.withIdentity(listed).mutation(api.roles.importFormRoles, {})).rejects.toThrow();
  });
});
