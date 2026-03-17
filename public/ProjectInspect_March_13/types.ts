// app/admin/types.ts
export type MediaItem = {
  PK: string;
  url: string;
  section: string;
  title: string;
  group?: string;
  person?: string;
  date?: string;
  description?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ItemsGetResponse =
  | { ok: true; items: MediaItem[]; count?: number }
  | { error: string; detail?: string };

export const ALL = "__ALL__"; // sentinel for "show everything"
