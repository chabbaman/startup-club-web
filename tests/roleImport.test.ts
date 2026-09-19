/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { FORM_ASSIGNMENTS } from "../convex/roleImport";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js", "!../convex/**/*.d.ts"]);
const teacher = { subject: "teacher", email: "thomasg@dlshs.org", name: "Teacher" };
const listed = { subject: "eric", email: "echeng28@dlshs.org", name: "Eric Cheng" };
const unlisted = { subject: "someone", email: "someone@dlshs.org", name: "Someone" };

describe("signup form role assignments", () => {
  test("first sign-in gets the listed existing roles and never creates roles", async () => {
    const t = convexTest(schema, modules);
    const asTeacher = t.withIdentity(teacher);
    const wanted = FORM_ASSIGNMENTS[listed.email];
    for (const name of wanted) await asTeacher.mutation(api.roles.createRole, { name, color: "pink" });

    await t.withIdentity(unlisted).mutation(api.roles.ensureUser, {});
    await t.withIdentity(listed).mutation(api.roles.ensureUser, {});
    await t.withIdentity(listed).mutation(api.roles.ensureUser, {});

    const view = await asTeacher.query(api.roles.adminView);
    expect(view.roles.map((r) => r.name).sort()).toEqual([...wanted].sort());
    const eric = view.users.find((u) => u.email === listed.email)!;
    expect(view.roles.filter((r) => eric.roleIds.includes(r._id)).map((r) => r.name).sort()).toEqual([...wanted].sort());
    expect(view.users.find((u) => u.email === unlisted.email)!.roleIds).toEqual([]);
  });

  test("reassignFormRoles drops the imported roles and applies the existing ones", async () => {
    const t = convexTest(schema, modules);
    const asTeacher = t.withIdentity(teacher);
    await asTeacher.mutation(api.roles.createRole, { name: "Engineering", color: "sky" });
    await t.withIdentity(listed).mutation(api.roles.ensureUser, {});
    let view = await asTeacher.query(api.roles.adminView);
    const eric = view.users.find((u) => u.email === listed.email)!;
    await asTeacher.mutation(api.roles.setUserRole, { userId: eric._id, roleId: view.roles[0]._id, assigned: true });
    for (const name of FORM_ASSIGNMENTS[listed.email]) {
      await asTeacher.mutation(api.roles.createRole, { name, color: "pink" });
    }

    const result = await t.mutation(internal.roleImport.reassignFormRoles, {});
    expect(result.deletedRoles).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.pending).toContain("25867@dlshs.org");
    expect(result.pending).not.toContain(listed.email);

    view = await asTeacher.query(api.roles.adminView);
    expect(view.roles.map((r) => r.name).sort()).toEqual([...FORM_ASSIGNMENTS[listed.email]].sort());
    const after = view.users.find((u) => u.email === listed.email)!;
    expect(after.roleIds.map((id) => view.roles.find((r) => r._id === id)?.name).sort()).toEqual(
      [...FORM_ASSIGNMENTS[listed.email]].sort(),
    );
  });
});
