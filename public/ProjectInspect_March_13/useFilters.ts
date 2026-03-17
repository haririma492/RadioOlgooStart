// app/admin/hooks/useFilters.ts
"use client";
import { useMemo, useState } from "react";
import { ALL, MediaItem } from "./types";

export function useFilters(allItems: MediaItem[]) {
  const [section, setSection] = useState<string>(ALL);
  const [group, setGroup] = useState<string>(ALL);
  const [search, setSearch] = useState<string>("");
  const [personFilter, setPersonFilter] = useState<string>("");
  const [titleFilter, setTitleFilter] = useState<string>("");

  const uniquePersons = useMemo(() => {
    const persons = new Set<string>();
    allItems.forEach((item) => {
      if (item.person && item.person.trim()) persons.add(item.person.trim());
    });
    return Array.from(persons).sort();
  }, [allItems]);

  const uniqueTitles = useMemo(() => {
    const titles = new Set<string>();
    allItems.forEach((item) => {
      if (item.title && item.title.trim()) titles.add(item.title.trim());
    });
    return Array.from(titles).sort();
  }, [allItems]);

  const filteredItems = useMemo(() => {
    let result = allItems;
    if (section !== ALL) result = result.filter((it) => it.section === section);
    if (group !== ALL) result = result.filter((it) => (it.group || "") === group);
    if (personFilter) result = result.filter((it) => (it.person || "").trim() === personFilter);
    if (titleFilter) result = result.filter((it) => (it.title || "").trim() === titleFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((it) => {
        const hay = [it.PK, it.url, it.title, it.description, it.person, it.section, it.group]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return result;
  }, [allItems, search, section, group, personFilter, titleFilter]);

  return {
    section, setSection,
    group, setGroup,
    search, setSearch,
    personFilter, setPersonFilter,
    titleFilter, setTitleFilter,
    uniquePersons, uniqueTitles,
    filteredItems,
  };
}

