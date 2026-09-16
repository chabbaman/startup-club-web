"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Avatar, Button, Card, Chip, Input, Label, Modal, Spinner, TextField } from "@heroui/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { COLORS, ColorPicker, RoleBadge, type AccentColor } from "./colors";
import { HistoryPanel } from "./HistoryPanel";
import { PollComposer } from "./Polls";

export function TeacherPanel() {
  const data = useQuery(api.roles.adminView);
  const createRole = useMutation(api.roles.createRole);
  const setUserRole = useMutation(api.roles.setUserRole);

  const [name, setName] = useState("");
  const [color, setColor] = useState<AccentColor>("violet");
  const [profileUserId, setProfileUserId] = useState<Doc<"users">["_id"] | null>(null);

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const profileUser = profileUserId
    ? (data.users.find((user) => user._id === profileUserId) ?? null)
    : null;
  const profileRoles = profileUser
    ? data.roles.filter((role) => profileUser.roleIds.includes(role._id))
    : [];
  const profileInitials = profileUser
    ? profileUser.name
        .split(" ")
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <PollComposer />
      <Card>
        <Card.Header>
          <Card.Title>Roles</Card.Title>
          <Card.Description>
            Roles show up as badges next to a member&apos;s name on every card they create.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await createRole({ name, color });
              setName("");
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <TextField className="flex-1">
              <Label>New role</Label>
              <Input
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. President"
              />
            </TextField>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Color</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <Button type="submit">Create role</Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {data.roles.length === 0 && <span className="text-xs text-muted">No roles yet.</span>}
            {data.roles.map((role) => (
              <RoleChip key={role._id} role={role} />
            ))}
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Members</Card.Title>
          <Card.Description>
            Everyone who has signed in. Click a role to toggle it for that member.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ul className="divide-y divide-separator">
            {data.users.length === 0 && (
              <li className="py-3 text-xs text-muted">Nobody has signed in yet.</li>
            )}
            {data.users.map((user) => {
              const initials = user.name
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <li key={user._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setProfileUserId(user._id)}
                    title={`View ${user.name}'s profile`}
                    aria-haspopup="dialog"
                    className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-default/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Avatar>
                      {user.image && <Avatar.Image src={user.image} alt="" />}
                      <Avatar.Fallback>{initials}</Avatar.Fallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground underline-offset-2 group-hover:underline">{user.name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {data.roles.map((role) => {
                      const on = user.roleIds.includes(role._id);
                      return (
                        <button
                          key={role._id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            void setUserRole({ userId: user._id, roleId: role._id, assigned: !on })
                          }
                          className="rounded-full transition hover:scale-105"
                        >
                          <Chip
                            size="sm"
                            variant={on ? "soft" : "tertiary"}
                            className={on ? COLORS[role.color].chip : "text-muted"}
                          >
                            {on ? "✓ " : "+ "}
                            {role.name}
                          </Chip>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card.Content>
      </Card>

      <HistoryPanel />

      <Modal.Backdrop
        isOpen={profileUser !== null}
        onOpenChange={(open) => { if (!open) setProfileUserId(null); }}
        variant="blur"
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            {profileUser && (
              <>
                <Modal.Header>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 shrink-0 text-base">
                      {profileUser.image && <Avatar.Image src={profileUser.image} alt="" />}
                      <Avatar.Fallback>{profileInitials}</Avatar.Fallback>
                    </Avatar>
                    <Modal.Heading className="min-w-0 break-words">{profileUser.name}</Modal.Heading>
                  </div>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-3">
                  <p className="truncate text-sm text-muted">{profileUser.email}</p>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Roles</span>
                    {profileRoles.length === 0 ? (
                      <span className="text-xs text-muted">No roles assigned.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {profileRoles.map((role) => (
                          <RoleBadge key={role._id} name={role.name} color={role.color} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                </Modal.Body>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </main>
  );
}

function RoleChip({ role }: { role: Doc<"roles"> }) {
  const updateRole = useMutation(api.roles.updateRole);
  const deleteRole = useMutation(api.roles.deleteRole);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState<AccentColor>(role.color);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(role.name);
          setColor(role.color);
          setOpen(true);
        }}
        title="Edit role"
        className="rounded-full transition hover:scale-105"
      >
        <RoleBadge name={role.name} color={role.color} size="md" />
      </button>

      <Modal.Backdrop isOpen={open} onOpenChange={setOpen} variant="blur">
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Edit role</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <TextField fullWidth>
                  <Label>Name</Label>
                  <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                </TextField>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Color</span>
                  <ColorPicker value={color} onChange={setColor} />
                </div>
              </Modal.Body>
              <Modal.Footer className="justify-between">
                <Button
                  variant="danger"
                  onPress={() => {
                    setOpen(false);
                    void deleteRole({ roleId: role._id });
                  }}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onPress={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onPress={async () => {
                      await updateRole({ roleId: role._id, name, color });
                      setOpen(false);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
    </>
  );
}
