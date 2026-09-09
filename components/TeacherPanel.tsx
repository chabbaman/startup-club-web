"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { COLORS, ColorPicker, RoleBadge, type AccentColor } from "./colors";

export function TeacherPanel() {
  const data = useQuery(api.roles.adminView);
  const createRole = useMutation(api.roles.createRole);
  const setUserRole = useMutation(api.roles.setUserRole);

  const [name, setName] = useState("");
  const [color, setColor] = useState<AccentColor>("violet");

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <section className="rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <h2 className="text-base font-bold text-zinc-900">Roles</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Roles show up as badges next to a member&apos;s name on every card they create.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await createRole({ name, color });
            setName("");
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New role, e.g. President"
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
          <ColorPicker value={color} onChange={setColor} />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Create role
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {data.roles.length === 0 && (
            <span className="text-xs text-zinc-400">No roles yet.</span>
          )}
          {data.roles.map((role) => (
            <RoleChip key={role._id} role={role} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <h2 className="text-base font-bold text-zinc-900">Members</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Everyone who has signed in. Click a role to toggle it for that member.
        </p>

        <ul className="mt-4 divide-y divide-zinc-200">
          {data.users.length === 0 && (
            <li className="py-3 text-xs text-zinc-400">Nobody has signed in yet.</li>
          )}
          {data.users.map((user) => (
            <li key={user._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-zinc-200" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
                  <p className="truncate text-xs text-zinc-400">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.roles.map((role) => {
                  const on = user.roleIds.includes(role._id);
                  return (
                    <button
                      key={role._id}
                      onClick={() =>
                        void setUserRole({ userId: user._id, roleId: role._id, assigned: !on })
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${
                        on
                          ? COLORS[role.color].badge
                          : "bg-transparent text-zinc-400 ring-zinc-300 hover:text-zinc-700 hover:ring-zinc-400"
                      }`}
                    >
                      {on ? "✓ " : "+ "}
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function RoleChip({ role }: { role: Doc<"roles"> }) {
  const updateRole = useMutation(api.roles.updateRole);
  const deleteRole = useMutation(api.roles.deleteRole);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState<AccentColor>(role.color);

  if (editing) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await updateRole({ roleId: role._id, name, color });
          setEditing(false);
        }}
        className="flex w-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete role "${role.name}"? It will be removed from everyone.`)) {
                void deleteRole({ roleId: role._id as Id<"roles"> });
              }
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </form>
    );
  }

  return (
    <button onClick={() => setEditing(true)} title="Edit role" className="transition hover:opacity-80">
      <RoleBadge name={role.name} color={role.color} />
    </button>
  );
}
