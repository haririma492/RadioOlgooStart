// app/admin/components/ItemsGrid.tsx
"use client";
import React from "react";
import { MediaItem, ALL } from "./types";
import { ItemCard } from "./ItemCard";

export function ItemsGrid({
  items,
  allItemsCount,
  section,
  group,
  renderCard,
}: {
  items: MediaItem[];
  allItemsCount: number;
  section: string;
  group: string;
  renderCard: (it: MediaItem) => React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-black text-slate-900">
          {items.length} Item{items.length !== 1 ? "s" : ""} {section !== ALL ? `in ${section}` : ""}{" "}
          {group !== ALL ? `→ ${group}` : ""}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => renderCard(it))}

        {!items.length && (
          <div className="opacity-70 font-bold p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-600 md:col-span-2 lg:col-span-3">
            {allItemsCount === 0 ? "No items uploaded yet." : "No items match the current filter."}
          </div>
        )}
      </div>
    </section>
  );
}
