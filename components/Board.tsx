"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useUser } from "@clerk/nextjs";
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

export function Board({ isTeacher }: { isTeacher: boolean }) {
  const board = useQuery(api.board.get);
  const { user } = useUser();
  const myId = user?.id;
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
          messageCounts={board.messageCounts ?? {}}
          isTeacher={isTeacher}
          myId={myId}
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
  messageCounts,
  isTeacher,
  myId,
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
  messageCounts: Record<string, number>;
  isTeacher: boolean;
  myId: string | undefined;
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
  // Deleting a column deletes its cards, so members may only delete columns
  // where every card is their own. Mirrors convex/access.ts requireColumnDeleter.
  const canDeleteColumn = isTeacher || cards.every((c) => c.createdBy === myId);

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
        {canDeleteColumn && (
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
        )}
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
                messageCount={messageCounts[card._id] ?? 0}
                canEdit={isTeacher || card.createdBy === myId}
                isTeacher={isTeacher}
                myId={myId}
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

function ReplyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function KanbanCard({
  card,
  badges,
  messageCount,
  canEdit,
  isTeacher,
  myId,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  card: CardWithFiles;
  badges: { name: string; color: AccentColor }[];
  messageCount: number;
  canEdit: boolean;
  isTeacher: boolean;
  myId: string | undefined;
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

  const saveCardDetails = async () => {
    if (title.trim() !== card.title || description !== (card.description ?? "")) {
      await updateCard({ cardId: card._id, title, description });
    }
  };

  const initials = initialsOf(card.createdByName);

  return (
    <>
      <Card
        variant="secondary"
        draggable={canEdit}
        onDragStart={
          canEdit
            ? (e) => {
                e.dataTransfer.effectAllowed = "move";
                onDragStart(card._id);
              }
            : undefined
        }
        onDragEnd={onDragEnd}
        onClick={openEditor}
        title="Open card thread"
        className={`group relative gap-2 rounded-2xl p-3 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md ${
          canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${isDragging ? "scale-[0.97] opacity-40" : ""}`}
      >
        {canEdit && (
          <motion.button
            type="button"
            aria-label={`Edit card "${card.title}"`}
            title="Edit card"
            onClick={(e) => {
              e.stopPropagation();
              openEditor();
            }}
            initial={{ scale: 0.7, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.15, rotate: -12 }}
            whileTap={{ scale: 0.9, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface/90 text-muted shadow-sm backdrop-blur transition-colors duration-200 hover:border-accent hover:bg-accent hover:text-white hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
          >
            <PencilIcon className="h-4 w-4" />
          </motion.button>
        )}
        <p className={`text-sm font-medium text-foreground ${canEdit ? "pr-10" : ""}`}>{card.title}</p>
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
        <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <ReplyIcon className="h-3.5 w-3.5" />
            {messageCount === 0 ? (
              <span>Reply</span>
            ) : (
              <span>
                {messageCount} {messageCount === 1 ? "reply" : "replies"}
              </span>
            )}
          </span>
          {card.files.length > 0 && <span>· 📎 {card.files.length}</span>}
        </div>
      </Card>

      <Modal.Backdrop isOpen={open} onOpenChange={setOpen} variant="blur">
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Card thread</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
                {/* Seed message: the card itself. Everything below replies to this. */}
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-default/30 p-3">
                  <div className="flex items-center gap-2">
                    <Avatar size="sm" className="h-6 w-6 text-[10px]">
                      {card.createdByImage && <Avatar.Image src={card.createdByImage} alt="" />}
                      <Avatar.Fallback>{initials}</Avatar.Fallback>
                    </Avatar>
                    <span className="truncate text-xs font-semibold">{card.createdByName}</span>
                    {badges.map((b) => (
                      <RoleBadge key={b.name} name={b.name} color={b.color} />
                    ))}
                    <Chip size="sm" variant="soft">
                      Seed
                    </Chip>
                    <span className="ml-auto shrink-0 text-[11px] text-muted">
                      {formatTime(card._creationTime)}
                    </span>
                  </div>
                  {canEdit ? (
                    <>
                      <TextField fullWidth>
                        <Label>Title</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                      </TextField>
                      <TextField fullWidth>
                        <Label>Details</Label>
                        <TextArea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Add details…"
                          rows={3}
                        />
                      </TextField>
                      {(title.trim() !== card.title ||
                        description !== (card.description ?? "")) && (
                        <div className="flex gap-2">
                          <Button size="sm" onPress={() => void saveCardDetails()}>
                            Save seed
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => {
                              setTitle(card.title);
                              setDescription(card.description ?? "");
                            }}
                          >
                            Reset
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">{card.title}</p>
                      {card.description && (
                        <p className="whitespace-pre-wrap text-sm text-foreground/80">
                          {card.description}
                        </p>
                      )}
                    </>
                  )}
                  <AttachmentPreview files={card.files} />
                </div>

                {open && (
                  <CardThread
                    cardId={card._id}
                    seedAuthorName={card.createdByName}
                    myId={myId}
                    isTeacher={isTeacher}
                  />
                )}

                {canEdit && <AttachmentManager cardId={card._id} files={card.files} />}
              </Modal.Body>
              <Modal.Footer className="justify-between">
                {canEdit ? (
                  <Button
                    variant="danger"
                    onPress={() => {
                      setOpen(false);
                      void deleteCard({ cardId: card._id });
                    }}
                  >
                    Delete card
                  </Button>
                ) : (
                  <span className="text-xs text-muted">
                    Only {card.createdByName} (or a teacher) can edit this card — anyone can reply.
                  </span>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" onPress={() => setOpen(false)}>
                    Close
                  </Button>
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
    </>
  );
}

type ReplyTarget = { _id: Id<"messages">; createdByName: string; text: string };

function QuoteBlock({
  name,
  text,
  deleted,
}: {
  name: string;
  text: string;
  deleted?: boolean;
}) {
  return (
    <div className="rounded-lg border-l-2 border-accent bg-default/60 px-2 py-1">
      <p className="text-[11px] font-semibold text-foreground">
        Replying to {deleted ? "a deleted reply" : name}
      </p>
      <p className={`line-clamp-2 text-[11px] ${deleted ? "italic text-muted" : "text-muted"}`}>
        {deleted ? "This reply was deleted." : text}
      </p>
    </div>
  );
}

function CardThread({
  cardId,
  seedAuthorName,
  myId,
  isTeacher,
}: {
  cardId: Id<"cards">;
  seedAuthorName: string;
  myId: string | undefined;
  isTeacher: boolean;
}) {
  const messages = useQuery(api.messages.list, { cardId });
  const addMessage = useMutation(api.messages.add);
  const updateMessage = useMutation(api.messages.update);
  const removeMessage = useMutation(api.messages.remove);

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<Id<"messages"> | null>(null);
  const [editText, setEditText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const focusComposer = () => composerRef.current?.focus();

  const startReply = (m: { _id: Id<"messages">; createdByName: string; text: string }) => {
    setReplyTo({ _id: m._id, createdByName: m.createdByName, text: m.text });
    setError(null);
    focusComposer();
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await addMessage(
        replyTo ? { cardId, text: trimmed, replyToId: replyTo._id } : { cardId, text: trimmed },
      );
      setText("");
      setReplyTo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send reply");
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async (id: Id<"messages">) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await updateMessage({ messageId: id, text: trimmed });
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save edit");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Replies{messages ? ` (${messages.length})` : ""}
      </p>

      {messages === undefined ? (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : messages.length === 0 ? (
        <p className="rounded-xl bg-default/30 px-3 py-2 text-xs text-muted">
          No replies yet — be the first to reply to {seedAuthorName}&rsquo;s seed message.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((m) => {
            const own = m.createdBy === myId;
            const canChange = own || isTeacher;
            const isEditing = editingId === m._id;
            return (
              <li
                key={m._id}
                className="flex gap-2 rounded-2xl border border-border bg-surface p-2.5"
              >
                <Avatar size="sm" className="h-6 w-6 shrink-0 text-[10px]">
                  {m.createdByImage && <Avatar.Image src={m.createdByImage} alt="" />}
                  <Avatar.Fallback>{initialsOf(m.createdByName)}</Avatar.Fallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold">{m.createdByName}</span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {formatTime(m._creationTime)}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-0.5">
                      <Tooltip>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label={`Reply to ${m.createdByName}`}
                          className="h-7 w-7 min-w-0"
                          onPress={() => startReply(m)}
                        >
                          <ReplyIcon className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>Reply to this message</Tooltip.Content>
                      </Tooltip>
                      {canChange && !isEditing && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Edit reply"
                            className="h-7 min-w-0 px-1.5 text-[11px]"
                            onPress={() => {
                              setEditingId(m._id);
                              setEditText(m.text);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Delete reply"
                            className="h-7 min-w-0 px-1.5 text-[11px] text-danger"
                            onPress={() => void removeMessage({ messageId: m._id })}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </span>
                  </div>

                  {m.replyTo && (
                    <QuoteBlock
                      name={m.replyTo.createdByName}
                      text={m.replyTo.text}
                      deleted={"deleted" in m.replyTo}
                    />
                  )}

                  {isEditing ? (
                    <div className="flex flex-col gap-1.5">
                      <TextArea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" onPress={() => void saveEdit(m._id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onPress={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">{m.text}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-default/20 p-2.5">
        {replyTo && (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <QuoteBlock name={replyTo.createdByName} text={replyTo.text} />
            </div>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label="Cancel reply"
              className="h-6 w-6 min-w-0 shrink-0"
              onPress={() => setReplyTo(null)}
            >
              ✕
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <TextArea
          ref={composerRef}
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            replyTo ? `Reply to ${replyTo.createdByName}…` : `Reply to ${seedAuthorName}'s card…`
          }
          rows={2}
        />
        <div className="flex justify-end">
          <Button size="sm" onPress={() => void send()} isDisabled={!text.trim() || sending}>
            <ReplyIcon className="h-3.5 w-3.5" />
            {sending ? "Sending…" : replyTo ? `Reply to ${replyTo.createdByName}` : "Reply"}
          </Button>
        </div>
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
