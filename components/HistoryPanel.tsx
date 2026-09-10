"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Avatar, Button, Card, Input, Label, Spinner, TextField } from "@heroui/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type Entry = FunctionReturnType<typeof api.history.list>[number];

const KIND_META: Record<Entry["kind"], { glyph: string; dot: string }> = {
  card_created: { glyph: "+", dot: "bg-teal-500" },
  card_updated: { glyph: "✎", dot: "bg-sky-500" },
  card_moved: { glyph: "→", dot: "bg-violet-500" },
  card_deleted: { glyph: "🗑", dot: "bg-rose-500" },
  column_created: { glyph: "+", dot: "bg-teal-500" },
  column_renamed: { glyph: "✎", dot: "bg-sky-500" },
  column_deleted: { glyph: "🗑", dot: "bg-rose-500" },
  attachment_added: { glyph: "📎", dot: "bg-amber-500" },
  attachment_removed: { glyph: "📎", dot: "bg-amber-500" },
};

function relativeTime(at: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayLabel(at: number): string {
  const date = new Date(at);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function HistoryPanel() {
  const entries = useQuery(api.history.list);
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    if (!entries) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.actorName, e.actorEmail, e.summary, e.before ?? "", e.after ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [entries, filter]);

  const groups = useMemo(() => {
    if (!visible) return [];
    const out: { label: string; items: Entry[] }[] = [];
    for (const entry of visible) {
      const label = dayLabel(entry.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else out.push({ label, items: [entry] });
    }
    return out;
  }, [visible]);

  return (
    <Card>
      <Card.Header>
        <Card.Title>Version history</Card.Title>
        <Card.Description>
          Every change to the board — who made it, when, and exactly what they wrote. Teachers
          can restore an earlier version of a card or column.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <TextField className="max-w-xs">
          <Label>Search history</Label>
          <Input
            fullWidth
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Person, card, or text…"
          />
        </TextField>

        {!visible ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {filter ? "Nothing matches that search." : "No activity yet — history starts logging from now on."}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {group.label}
              </h3>
              <ol className="relative ml-1.5 flex flex-col border-l-2 border-separator pl-5">
                {group.items.map((entry) => (
                  <HistoryItem key={entry._id} entry={entry} />
                ))}
              </ol>
            </section>
          ))
        )}
      </Card.Content>
    </Card>
  );
}

function HistoryItem({ entry }: { entry: Entry }) {
  const meta = KIND_META[entry.kind];
  return (
    <li className="relative flex flex-col gap-1.5 py-3">
      <span
        aria-hidden
        className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full ring-4 ring-surface ${meta.dot}`}
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Avatar size="sm" className="h-5 w-5 text-[9px]">
          {entry.actorImage && <Avatar.Image src={entry.actorImage} alt="" />}
          <Avatar.Fallback>{initials(entry.actorName)}</Avatar.Fallback>
        </Avatar>
        <span className="text-sm font-medium text-foreground">{entry.actorName}</span>
        <span
          className="text-xs text-muted"
          title={new Date(entry.at).toLocaleString()}
        >
          {relativeTime(entry.at)} ·{" "}
          {new Date(entry.at).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-sm text-foreground">
        <span aria-hidden className="mr-1.5 text-muted">
          {meta.glyph}
        </span>
        {entry.summary.replace(`${entry.actorName} `, "")}
      </p>
      <ChangeText entry={entry} />
      {entry.canRestore && <RestoreButton entryId={entry._id} />}
    </li>
  );
}

/** Shows the actual text that was written (or deleted), expandable when long. */
function ChangeText({ entry }: { entry: Entry }) {
  const [expanded, setExpanded] = useState(false);
  const { before, after } = entry;
  if (before === undefined && after === undefined) return null;
  if (before !== undefined && before === after) return null;

  const long = (before?.length ?? 0) + (after?.length ?? 0) > 160;
  const collapsed = long && !expanded;

  return (
    <div className="flex max-w-xl flex-col gap-1.5">
      {before !== undefined && before !== "" && (
        <div
          className={`whitespace-pre-wrap rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-foreground ${
            collapsed ? "line-clamp-2" : ""
          }`}
        >
          <span className="font-semibold text-rose-600">
            {after !== undefined && after !== "" ? "Was: " : "Deleted: "}
          </span>
          {before}
        </div>
      )}
      {after !== undefined && after !== "" && before !== after && (
        <div
          className={`whitespace-pre-wrap rounded-lg bg-teal-500/10 px-2.5 py-1.5 text-xs text-foreground ${
            collapsed ? "line-clamp-2" : ""
          }`}
        >
          {before !== undefined && before !== "" && (
            <span className="font-semibold text-teal-700">Now: </span>
          )}
          {after}
        </div>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs font-medium text-muted hover:text-foreground"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function RestoreButton({ entryId }: { entryId: Entry["_id"] }) {
  const restore = useMutation(api.history.restore);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-xs font-medium text-teal-700">✓ Restored</p>;
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" variant="outline" onPress={() => {
          setError(null);
          setConfirming(true);
        }}>
          Restore this version
        </Button>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-xs text-muted">
        This will change the board back to this version. Continue?
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onPress={async () => {
            try {
              await restore({ entryId });
              setConfirming(false);
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Restore failed");
              setConfirming(false);
            }
          }}
        >
          Yes, restore
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
