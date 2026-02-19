/**
 * Shape of a media item as returned by GET /api/media
 */
export type MediaItem = {
  PK: string;
  url: string;
  section: string;
  group: string;
  person: string;
  title: string;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};
