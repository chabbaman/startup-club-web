"use client";

import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { COLORS, ColorPicker, RoleBadge, type AccentColor } from "./colors";

type Badges = Record<string, { name: string; color: AccentColor }[]>;

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
      Loading board…
    </div>
  );
}

export function Board() {
  const board = useQuery(api.board.get);
  const seed = useMutation(api.board.seedIfEmpty);
  const moveCard = useMutation(api.board.moveCard);
  const addColumn = useMutation(api.board.addColumn);

  const [dragging, setDragging] = useState<Id<"cards"> | null>(null);
  const [dropTarget, setDropTarget] = useState<{ columnId: Id<"columns">; index: number } | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);

  useEffect(() => {
    if (board && board.columns.length === 0) void seed();
  }, [board, seed]);

  if (!board) return <Loading />;

  const onDrop = async (columnId: Id<"columns">, index: number) => {
    if (!dragging) return;
    const id = dragging;
    setDragging(null);
    setDropTarget(null);
    await moveCard({ cardId: id, toColumnId: columnId, toIndex: index });
  };

  return (
    <main className="relative z-10 flex flex-1 items-start gap-4 overflow-x-auto p-4 sm:p-6">
      {board.columns.map((column) => (
        <Column
          key={column._id}
          column={column}
          cards={board.cards.filter((c) => c.columnId === column._id)}
          badges={board.badges}
          dragging={dragging}
          dropTarget={dropTarget?.columnId === column._id ? dropTarget.index : null}
          onDragStart={setDragging}
          onDragEnd={() => {
            setDragging(null);
            setDropTarget(null);
          }}
          onDragOver={(index) => setDropTarget({ columnId: column._id, index })}
          onDrop={(index) => void onDrop(column._id, index)}
        />
      ))}

      <div className="w-72 shrink-0">
        {addingColumn ? (
          <NewColumnForm
            onCancel={() => setAddingColumn(false)}
            onSubmit={async (title, color) => {
              await addColumn({ title, color });
              setAddingColumn(false);
            }}
          />
        ) : (
          <button
            onClick={() => setAddingColumn(true)}
            className="w-full rounded-2xl border-2 border-dashed border-zinc-300 bg-white/40 px-4 py-3 text-sm font-medium text-zinc-500 transition hover:border-zinc-400 hover:bg-white/70 hover:text-zinc-700"
          >
            + Add column
          </button>
        )}
      </div>
    </main>
  );
}

function Column({
  column,
  cards,
  badges,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  column: Doc<"columns">;
  cards: Doc<"cards">[];
  badges: Badges;
  dragging: Id<"cards"> | null;
  dropTarget: number | null;
  onDragStart: (id: Id<"cards">) => void;
  onDragEnd: () => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
}) {
  const colors = COLORS[column.color];
  const renameColumn = useMutation(api.board.renameColumn);
  const deleteColumn = useMutation(api.board.deleteColumn);
  const addCard = useMutation(api.board.addCard);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [newCard, setNewCard] = useState("");
  const [showNewCard, setShowNewCard] = useState(false);

  const submitCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCard.trim()) return;
    await addCard({ columnId: column._id, title: newCard });
    setNewCard("");
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    onDragOver(index);
  };

  const isDropping = dragging !== null && dropTarget !== null;

  return (
    <section
      className={`flex w-72 shrink-0 flex-col rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur ${
        isDropping ? `ring-2 ${colors.ring}` : ""
      }`}
      onDragOver={(e) => handleDragOver(e, cards.length)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(dropTarget ?? cards.length);
      }}
    >
      <header className={`flex items-center gap-2 rounded-t-2xl px-3 py-2.5 ${colors.header}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={async () => {
              setEditingTitle(false);
              if (title.trim() && title !== column.title) {
                await renameColumn({ columnId: column._id, title });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitle(column.title);
                setEditingTitle(false);
              }
            }}
            className="flex-1 rounded bg-white/60 px-1.5 py-0.5 text-sm font-semibold text-zinc-900 outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setTitle(column.title);
              setEditingTitle(true);
            }}
            className="flex-1 truncate text-left text-sm font-semibold"
            title="Rename column"
          >
            {column.title}
          </button>
        )}
        <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium">{cards.length}</span>
        <button
          onClick={() => {
            const ok =
              cards.length === 0 ||
              confirm(`Delete "${column.title}" and its ${cards.length} card(s)?`);
            if (ok) void deleteColumn({ columnId: column._id });
          }}
          className={`rounded px-1.5 text-xs opacity-60 transition hover:opacity-100 ${colors.button}`}
          title="Delete column"
        >
          ✕
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {cards.map((card, i) => (
          <div
            key={card._id}
            onDragOver={(e) => {
              e.stopPropagation();
              handleDragOver(e, i);
            }}
          >
            {dragging && dropTarget === i && dragging !== card._id && (
              <div className={`mb-2 h-1 rounded-full ${colors.dot}`} />
            )}
            <Card
              card={card}
              badges={badges[card.createdBy] ?? []}
              isDragging={dragging === card._id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </div>
        ))}
        {dragging && dropTarget === cards.length && (
          <div className={`h-1 rounded-full ${colors.dot}`} />
        )}

        {showNewCard ? (
          <form onSubmit={submitCard} className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={newCard}
              onChange={(e) => setNewCard(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitCard(e);
                }
                if (e.key === "Escape") setShowNewCard(false);
              }}
              placeholder="What needs doing?"
              rows={2}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowNewCard(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowNewCard(true)}
            className="rounded-xl px-3 py-2 text-left text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            + Add a card
          </button>
        )}
      </div>
    </section>
  );
}

function Card({
  card,
  badges,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  card: Doc<"cards">;
  badges: { name: string; color: AccentColor }[];
  isDragging: boolean;
  onDragStart: (id: Id<"cards">) => void;
  onDragEnd: () => void;
}) {
  const updateCard = useMutation(api.board.updateCard);
  const deleteCard = useMutation(api.board.deleteCard);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");

  const save = async () => {
    setEditing(false);
    if (title.trim() !== card.title || description !== (card.description ?? "")) {
      await updateCard({ cardId: card._id, title, description });
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-3 shadow-md">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-400"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details…"
          rows={3}
          className="resize-none rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => void save()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              setTitle(card.title);
              setDescription(card.description ?? "");
              setEditing(false);
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${card.title}"?`)) void deleteCard({ cardId: card._id });
            }}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(card._id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => setEditing(true)}
      className={`cursor-grab rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="text-sm font-medium text-zinc-900">{card.title}</p>
      {card.description && (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-500">
          {card.description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.createdByImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.createdByImage} alt="" className="h-4 w-4 rounded-full" />
        ) : (
          <span className="h-4 w-4 rounded-full bg-zinc-200" />
        )}
        <span className="truncate text-[11px] text-zinc-400">{card.createdByName}</span>
        {badges.map((b) => (
          <RoleBadge key={b.name} name={b.name} color={b.color} />
        ))}
      </div>
    </div>
  );
}

function NewColumnForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (title: string, color: AccentColor) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<AccentColor>("sky");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await onSubmit(title, color);
      }}
      className="flex flex-col gap-3 rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder="Column name"
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
        >
          Add column
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
