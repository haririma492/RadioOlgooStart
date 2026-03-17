// app/admin/components/FilterBar.tsx
"use client";
import React from "react";
import { ALL } from "./types";

export function FilterBar({
  busy,
  authorized,
  section,
  setSection,
  group,
  setGroup,
  sectionList,
  groupOptions,
  personFilter,
  setPersonFilter,
  titleFilter,
  setTitleFilter,
  uniquePersons,
  uniqueTitles,
  search,
  setSearch,
  filteredCount,
  totalCount,
  onClearAll,
}: {
  busy: boolean;
  authorized: boolean;
  section: string;
  setSection: (v: string) => void;
  group: string;
  setGroup: (v: string) => void;
  sectionList: string[];
  groupOptions: string[];
  personFilter: string;
  setPersonFilter: (v: string) => void;
  titleFilter: string;
  setTitleFilter: (v: string) => void;
  uniquePersons: string[];
  uniqueTitles: string[];
  search: string;
  setSearch: (v: string) => void;
  filteredCount: number;
  totalCount: number;
  onClearAll: () => void;
}) {
  return (
    <section className="sticky top-0 z-20 mb-3 bg-white/95 backdrop-blur-md rounded-lg border border-slate-200 shadow-sm p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={busy || !authorized}
        >
          <option value={ALL}>All Sections</option>
          {sectionList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={busy || !authorized}
        >
          <option value={ALL}>All Groups</option>
          {groupOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={busy || !authorized}
        >
          <option value="">All Persons</option>
          {uniquePersons.map((person) => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </select>

        <select
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={busy || !authorized}
        >
          <option value="">All Titles</option>
          {uniqueTitles.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[150px] max-w-[250px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={busy || !authorized}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {(section !== ALL || group !== ALL || search || personFilter || titleFilter) && (
          <button
            onClick={onClearAll}
            className="px-2 py-1 rounded text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            Clear All
          </button>
        )}

        <div className="ml-auto flex items-center">
          <span className="px-2 py-1 rounded bg-slate-100 text-xs font-bold text-slate-700">
            {filteredCount}/{totalCount}
          </span>
        </div>
      </div>
    </section>
  );
}
