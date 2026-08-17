"use client";

import { CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#8b5cf6",
  "#f43f5e",
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#eab308",
];

interface CollectionColorPickerProps {
  color: string;
  onColorChange: (color: string) => void;
}

export function CollectionColorPicker({
  color,
  onColorChange,
}: CollectionColorPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label="No color"
        aria-pressed={!color}
        onClick={() => onColorChange("")}
      >
        <CircleSlash className={cn("size-4", !color && "text-primary")} />
      </Button>
      {PALETTE.map((c) => {
        const selected = color === c;
        return (
          <Button
            key={c}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Use color ${c}`}
            aria-pressed={selected}
            onClick={() => onColorChange(c)}
            className={cn(
              "rounded-full border-2 border-transparent hover:scale-105",
              selected && "border-foreground",
            )}
            style={{ backgroundColor: c }}
          />
        );
      })}
    </div>
  );
}