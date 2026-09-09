import type { Doc } from "@/convex/_generated/dataModel";

export type AccentColor = Doc<"columns">["color"];

export const COLORS: Record<
  AccentColor,
  { header: string; dot: string; ring: string; button: string; swatch: string; badge: string }
> = {
  coral: {
    header: "bg-rose-100 text-rose-900",
    dot: "bg-rose-500",
    ring: "ring-rose-300",
    button: "hover:bg-rose-200",
    swatch: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800 ring-rose-300",
  },
  amber: {
    header: "bg-amber-100 text-amber-900",
    dot: "bg-amber-500",
    ring: "ring-amber-300",
    button: "hover:bg-amber-200",
    swatch: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800 ring-amber-300",
  },
  lime: {
    header: "bg-lime-100 text-lime-900",
    dot: "bg-lime-500",
    ring: "ring-lime-300",
    button: "hover:bg-lime-200",
    swatch: "bg-lime-500",
    badge: "bg-lime-100 text-lime-800 ring-lime-300",
  },
  teal: {
    header: "bg-teal-100 text-teal-900",
    dot: "bg-teal-500",
    ring: "ring-teal-300",
    button: "hover:bg-teal-200",
    swatch: "bg-teal-500",
    badge: "bg-teal-100 text-teal-800 ring-teal-300",
  },
  sky: {
    header: "bg-sky-100 text-sky-900",
    dot: "bg-sky-500",
    ring: "ring-sky-300",
    button: "hover:bg-sky-200",
    swatch: "bg-sky-500",
    badge: "bg-sky-100 text-sky-800 ring-sky-300",
  },
  violet: {
    header: "bg-violet-100 text-violet-900",
    dot: "bg-violet-500",
    ring: "ring-violet-300",
    button: "hover:bg-violet-200",
    swatch: "bg-violet-500",
    badge: "bg-violet-100 text-violet-800 ring-violet-300",
  },
  pink: {
    header: "bg-pink-100 text-pink-900",
    dot: "bg-pink-500",
    ring: "ring-pink-300",
    button: "hover:bg-pink-200",
    swatch: "bg-pink-500",
    badge: "bg-pink-100 text-pink-800 ring-pink-300",
  },
};

export const COLOR_KEYS = Object.keys(COLORS) as AccentColor[];

export function RoleBadge({ name, color }: { name: string; color: AccentColor }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${COLORS[color].badge}`}
    >
      {name}
    </span>
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
    <div className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-label={key}
          className={`h-6 w-6 rounded-full ${COLORS[key].swatch} ${
            value === key ? "ring-2 ring-zinc-900 ring-offset-2" : ""
          }`}
        />
      ))}
    </div>
  );
}
