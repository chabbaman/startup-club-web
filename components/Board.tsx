"use client";

import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  Spinner,
  TextArea,
  TextField,
  Tooltip,
} from "@heroui/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { COLORS, ColorPicker, RoleBadge, type AccentColor } from "./colors";
import { AttachmentManager, AttachmentPreview, type CardFile } from "./Attachments";

type Badges = Record<string, { name: string; color: AccentColor }[]>;
type CardWithFiles = Doc<"cards"> & { files: CardFile[] };

const spring = { type: "spring", stiffness: 500, damping: 38, mass: 0.8 } as const;

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Board() {
  const board = useQuery(api.board.get);
  const seed = useMutation(api.board.seedIfEmpty);
  const moveCard = useMutation(api.board.moveCard).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.board.get, {});
    if (!current) return;
    const card = current.cards.find((c) => c._id === args.cardId);
    if (!card) return;
    const others = current.cards.filter((c) => c._id !== args.cardId);
    const target = others
      .filter((c) => c.columnId === args.toColumnId)
      .sort((a, b) => a.order - b.order);
    target.splice(Math.min(args.toIndex, target.length), 0, { ...card, columnId: args.toColumnId });
    const rest = others.filter((c) => c.columnId !== args.toColumnId);
    const cards = [...rest, ...target.map((c, i) => ({ ...c, order: i }))].sort(
      (a, b) => a.order - b.order,
    );
    store.setQuery(api.board.get, {}, { ...current, cards });
  });
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
    <main className="flex flex-1 items-start gap-4 overflow-x-auto p-4 sm:p-6">
      <LayoutGroup>
      <AnimatePresence initial={false} mode="popLayout">
      {board.columns.map((column) => (
        <Column
          key={column._id}
          column={column}
          cards={board.cards.filter((c) => c.columnId === column._id)}
          badges={board.badges}
          dragging={dragging}
          dragOutside={
            dragging !== null &&
            dropTarget !== null &&
            dropTarget.columnId !== column._id &&
            board.cards.some((c) => c._id === dragging && c.columnId === column._id)
          }
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
      </AnimatePresence>
      </LayoutGroup>

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
          <Button variant="outline" fullWidth onPress={() => setAddingColumn(true)}>
            + Add column
          </Button>
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
  dragOutside,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  column: Doc<"columns">;
  cards: CardWithFiles[];
  badges: Badges;
  dragging: Id<"cards"> | null;
  dragOutside: boolean;
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submitCard = async (e?: FormEvent) => {
    e?.preventDefault();
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
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={spring}
      className="shrink-0"
    >
    <Card
      className={`w-72 gap-0 overflow-hidden rounded-2xl p-0 transition-shadow ${
        isDropping ? `ring-2 ${colors.ring}` : ""
      }`}
      onDragOver={(e) => handleDragOver(e, cards.length)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(dropTarget ?? cards.length);
      }}
    >
      <Card.Header className={`flex flex-row items-center gap-2 px-3 py-2.5 ${colors.header}`}>
        {editingTitle ? (
          <Input
            autoFocus
            fullWidth
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
            className="text-sm font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitle(column.title);
              setEditingTitle(true);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            title="Rename column"
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors.dot}`} />
            <span className="truncate text-sm font-semibold">{column.title}</span>
          </button>
        )}
        <Chip size="sm" variant="soft" className="bg-white/60 text-current">
          {cards.length}
        </Chip>
        <Tooltip>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label="Delete column"
            onPress={() => {
              if (cards.length === 0) void deleteColumn({ columnId: column._id });
              else setConfirmDelete(true);
            }}
          >
            ✕
          </Button>
          <Tooltip.Content>Delete column</Tooltip.Content>
        </Tooltip>
      </Card.Header>

      <Card.Content className="flex flex-col gap-2 p-2">
        <AnimatePresence initial={false} mode="popLayout">
          {cards.map((card, i) => (
            <motion.div
              key={card._id}
              layout
              layoutId={card._id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={
                dragging === card._id && dragOutside
                  ? { opacity: 0, height: 0, marginBottom: -8, scale: 0.95 }
                  : { opacity: 1, y: 0, scale: 1, height: "auto", marginBottom: 0 }
              }
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
              transition={spring}
              style={{ overflow: "visible" }}
              onDragOver={(e) => {
                e.stopPropagation();
                handleDragOver(e, i);
              }}
            >
              <DropIndicator
                show={!!dragging && dropTarget === i && dragging !== card._id}
                color={colors.dot}
              />
              <KanbanCard
                card={card}
                badges={badges[card.createdBy] ?? []}
                isDragging={dragging === card._id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <DropIndicator show={!!dragging && dropTarget === cards.length} color={colors.dot} />

        {showNewCard ? (
          <form onSubmit={submitCard} className="flex flex-col gap-2">
            <TextArea
              autoFocus
              fullWidth
              value={newCard}
              onChange={(e) => setNewCard(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitCard();
                }
                if (e.key === "Escape") setShowNewCard(false);
              }}
              placeholder="What needs doing?"
              rows={2}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Add
              </Button>
              <Button variant="ghost" size="sm" onPress={() => setShowNewCard(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="ghost" size="sm" className="justify-start" onPress={() => setShowNewCard(true)}>
            + Add a card
          </Button>
        )}
      </Card.Content>

      <Modal.Backdrop isOpen={confirmDelete} onOpenChange={setConfirmDelete} variant="blur">
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Delete “{column.title}”?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  This will also delete the {cards.length} card{cards.length === 1 ? "" : "s"} in
                  this column. This cannot be undone.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    setConfirmDelete(false);
                    void deleteColumn({ columnId: column._id });
                  }}
                >
                  Delete column
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
    </Card>
    </motion.div>
  );
}

function DropIndicator({ show, color }: { show: boolean; color: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="indicator"
          layout
          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
          animate={{ height: 4, opacity: 1, marginBottom: 8 }}
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ duration: 0.15 }}
          className={`rounded-full ${color}`}
        />
      )}
    </AnimatePresence>
  );
}

function KanbanCard({
  card,
  badges,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  card: CardWithFiles;
  badges: { name: string; color: AccentColor }[];
  isDragging: boolean;
  onDragStart: (id: Id<"cards">) => void;
  onDragEnd: () => void;
}) {
  const updateCard = useMutation(api.board.updateCard);
  const deleteCard = useMutation(api.board.deleteCard);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");

  const openEditor = () => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setOpen(true);
  };

  const save = async () => {
    setOpen(false);
    if (title.trim() !== card.title || description !== (card.description ?? "")) {
      await updateCard({ cardId: card._id, title, description });
    }
  };

  const initials = card.createdByName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Card
        variant="secondary"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(card._id);
        }}
        onDragEnd={onDragEnd}
        onClick={openEditor}
        className={`cursor-grab gap-2 rounded-2xl p-3 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
          isDragging ? "scale-[0.97] opacity-40" : ""
        }`}
      >
        <p className="text-sm font-medium text-foreground">{card.title}</p>
        {card.description && (
          <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted">{card.description}</p>
        )}
        <AttachmentPreview files={card.files} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Avatar size="sm" className="h-5 w-5 text-[9px]">
            {card.createdByImage && <Avatar.Image src={card.createdByImage} alt="" />}
            <Avatar.Fallback>{initials}</Avatar.Fallback>
          </Avatar>
          <span className="truncate text-[11px] text-muted">{card.createdByName}</span>
          {badges.map((b) => (
            <RoleBadge key={b.name} name={b.name} color={b.color} />
          ))}
        </div>
      </Card>

      <Modal.Backdrop isOpen={open} onOpenChange={setOpen} variant="blur">
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Edit card</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <TextField fullWidth>
                  <Label>Title</Label>
                  <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
                </TextField>
                <TextField fullWidth>
                  <Label>Details</Label>
                  <TextArea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add details…"
                    rows={5}
                  />
                </TextField>
                <AttachmentManager cardId={card._id} files={card.files} />
              </Modal.Body>
              <Modal.Footer className="justify-between">
                <Button
                  variant="danger"
                  onPress={() => {
                    setOpen(false);
                    void deleteCard({ cardId: card._id });
                  }}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onPress={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onPress={() => void save()}>Save</Button>
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
    </>
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
    <Card className="gap-3 p-3">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          await onSubmit(title, color);
        }}
        className="flex flex-col gap-3"
      >
        <Input
          autoFocus
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          placeholder="Column name"
        />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Add column
          </Button>
          <Button variant="ghost" size="sm" onPress={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
