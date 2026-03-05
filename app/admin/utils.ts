// app/admin/utils.ts
import { MediaItem } from "./types";

export function nowTime() {
  return new Date().toLocaleTimeString([], { hour12: true });
}

export function isVideo(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".mp4") || u.includes("video");
}

export function isImage(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.includes(".jpg") || u.includes(".jpeg") || u.includes(".png") || u.includes(".webp");
}

export function s3KeyFromPublicUrl(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const key = u.pathname?.replace(/^\/+/, "");
    if (!key) return null;
    return key;
  } catch {
    return null;
  }
}

export function renderableUrl(it: MediaItem, signedUrlByPk: Record<string, string>): string {
  return signedUrlByPk[it.PK] || it.url;
}
