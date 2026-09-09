"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useMutation } from "convex/react";
import { Button, Chip, Spinner, Tooltip } from "@heroui/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type CardFile = {
  storageId: Id<"_storage">;
  name: string;
  type: string;
  size: number;
  url: string | null;
};

const MAX_BYTES = 25 * 1024 * 1024;

export const isImage = (type: string) => type.startsWith("image/");

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Uploads files to Convex storage and links them to a card. */
export function useUploader(cardId: Id<"cards">) {
  const generateUploadUrl = useMutation(api.board.generateUploadUrl);
  const addAttachment = useMutation(api.board.addAttachment);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name || "File"} is larger than 25 MB`);
        continue;
      }
      // Pasted images often have no name; give them one so the chip reads well.
      const name =
        file.name && file.name !== "image.png"
          ? file.name
          : `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${
              file.type.split("/")[1] ?? "png"
            }`;
      setPending((p) => [...p, name]);
      try {
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await addAttachment({
          cardId,
          storageId,
          name,
          type: file.type || "application/octet-stream",
          size: file.size,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setPending((p) => p.filter((n) => n !== name));
      }
    }
  };

  return { upload, pending, error };
}

/** Compact preview shown on the kanban card itself. */
export function AttachmentPreview({ files }: { files: CardFile[] }) {
  if (files.length === 0) return null;
  const images = files.filter((f) => isImage(f.type) && f.url);
  const others = files.filter((f) => !isImage(f.type) || !f.url);

  return (
    <div className="flex flex-col gap-1.5">
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.slice(0, 4).map((f, i) => (
            <div
              key={f.storageId}
              className={`relative overflow-hidden rounded-xl bg-default ${
                images.length === 1 ? "aspect-video" : "aspect-square"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url!} alt={f.name} className="h-full w-full object-cover" />
              {i === 3 && images.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                  +{images.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {others.map((f) => (
            <Chip key={f.storageId} size="sm" variant="soft" className="max-w-full">
              <span className="truncate">📎 {f.name}</span>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full attachment manager for the edit modal: list, remove, attach, paste, drop. */
export function AttachmentManager({
  cardId,
  files,
}: {
  cardId: Id<"cards">;
  files: CardFile[];
}) {
  const { upload, pending, error } = useUploader(cardId);
  const removeAttachment = useMutation(api.board.removeAttachment);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onPaste = (e: ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length > 0) {
      e.preventDefault();
      void upload(pasted);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) void upload(e.dataTransfer.files);
  };

  return (
    <div
      onPaste={onPaste}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`flex flex-col gap-3 rounded-2xl border-2 border-dashed p-3 transition ${
        dragOver ? "border-accent bg-accent/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Attachments</p>
          <p className="text-xs text-muted">Attach a file, drop one here, or paste an image.</p>
        </div>
        <Button size="sm" variant="secondary" onPress={() => inputRef.current?.click()}>
          Attach file
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {(files.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f) => (
            <li
              key={f.storageId}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface"
            >
              {isImage(f.type) && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center">
                  <span className="text-2xl">📎</span>
                  <span className="line-clamp-2 text-[11px] text-muted">{f.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-1 px-2 py-1">
                <a
                  href={f.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-[11px] text-link hover:underline"
                  title={f.name}
                >
                  {f.name}
                </a>
                <span className="shrink-0 text-[10px] text-muted">{formatBytes(f.size)}</span>
              </div>
              <Tooltip>
                <Button
                  size="sm"
                  variant="danger"
                  isIconOnly
                  aria-label={`Remove ${f.name}`}
                  className="absolute right-1 top-1 h-6 w-6 min-w-0 opacity-0 transition group-hover:opacity-100"
                  onPress={() => void removeAttachment({ cardId, storageId: f.storageId })}
                >
                  ✕
                </Button>
                <Tooltip.Content>Remove</Tooltip.Content>
              </Tooltip>
            </li>
          ))}
          {pending.map((name) => (
            <li
              key={name}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center"
            >
              <Spinner size="sm" />
              <span className="line-clamp-2 px-2 text-[11px] text-muted">{name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
