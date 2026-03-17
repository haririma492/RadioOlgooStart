// app/admin/utils/index.ts
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

export function guessContentType(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export function s3KeyFromPublicUrl(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const key = u.pathname?.replace(/^\/+/, "");
    return key || null;
  } catch {
    return null;
  }
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url || "");
}