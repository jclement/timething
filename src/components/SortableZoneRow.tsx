/**
 * SortableZoneRow — a ZoneRow wrapped in dnd-kit's useSortable so the
 * user can drag non-home rows up or down to reorder them. Supplies a
 * grip-icon drag handle to the inner ZoneRow.
 *
 * The home row is rendered outside any sortable context, so only the
 * additional zones participate in reordering.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ZoneRow } from "./ZoneRow";
import type { ComponentProps } from "react";

type BaseProps = ComponentProps<typeof ZoneRow>;

/** ZoneRow wrapped in dnd-kit's useSortable, with a grip-icon drag handle. */
export function SortableZoneRow(props: Omit<BaseProps, "dragHandle">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.zone.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // Elevate the row above others while dragging so the transform doesn't
    // clip behind the next row's sticky-left label.
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const handle = (
    <button
      type="button"
      aria-label="Reorder zone"
      className="no-print flex-shrink-0 h-6 w-5 flex items-center justify-center text-muted/70 hover:text-body hover:bg-hover rounded cursor-grab active:cursor-grabbing touch-none"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <ZoneRow {...props} dragHandle={handle} />
    </div>
  );
}
