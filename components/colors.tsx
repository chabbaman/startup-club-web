import { Chip } from "@heroui/react";
import type { Doc } from "@/convex/_generated/dataModel";

export type AccentColor = Doc<"columns">["color"];

export const COLORS: Record<
  AccentColor,
  { label: string; header: string; bar: string; dot: string; ring: string; swatch: string; chip: string }
> = {
  coral: {
    header: "bg-rose-100 text-rose-900",
    label: "Coral",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    ring: "ring-rose-400",
    swatch: "bg-rose-500",
    chip: "bg-rose-100 text-rose-800",
  },
  amber: {
    header: "bg-amber-100 text-amber-900",
    label: "Amber",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    ring: "ring-amber-400",
    swatch: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
  },
  lime: {
    header: "bg-lime-100 text-lime-900",
    label: "Lime",
    bar: "bg-lime-500",
    dot: "bg-lime-500",
    ring: "ring-lime-400",
    swatch: "bg-lime-500",
    chip: "bg-lime-100 text-lime-800",
  },
  teal: {
    header: "bg-teal-100 text-teal-900",
    label: "Teal",
    bar: "bg-teal-500",
    dot: "bg-teal-500",
    ring: "ring-teal-400",
    swatch: "bg-teal-500",
    chip: "bg-teal-100 text-teal-800",
  },
  sky: {
    header: "bg-sky-100 text-sky-900",
    label: "Sky",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    ring: "ring-sky-400",
    swatch: "bg-sky-500",
    chip: "bg-sky-100 text-sky-800",
  },
  violet: {
    header: "bg-violet-100 text-violet-900",
    label: "Violet",
    bar: "bg-violet-500",
    dot: "bg-violet-500",
    ring: "ring-violet-400",
    swatch: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800",
  },
  pink: {
    header: "bg-pink-100 text-pink-900",
    label: "Pink",
    bar: "bg-pink-500",
    dot: "bg-pink-500",
    ring: "ring-pink-400",
    swatch: "bg-pink-500",
    chip: "bg-pink-100 text-pink-800",
  },
};

export const COLOR_KEYS = Object.keys(COLORS) as AccentColor[];

export function RoleBadge({
  name,
  color,
  size = "sm",
}: {
  name: string;
  color: AccentColor;
  size?: "sm" | "md";
}) {
  return (
    <Chip size={size} variant="soft" className={COLORS[color].chip}>
      {name}
    </Chip>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: AccentColor;
  onChange: (c: AccentColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          aria-label={COLORS[key].label}
          title={COLORS[key].label}
          className={`h-6 w-6 rounded-full transition hover:scale-110 ${COLORS[key].swatch} ${
            value === key ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""
          }`}
        />
      ))}
    </div>
  );
}
