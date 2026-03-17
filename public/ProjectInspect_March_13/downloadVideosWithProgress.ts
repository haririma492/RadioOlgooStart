// app/admin/youtube/downloadVideosWithProgress.ts
"use client";

export async function downloadVideosWithProgress(videos: any[], token: string, pushLog: (line: string) => void) {
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    try {
      pushLog(`\n📹 Video ${i + 1}/${videos.length}: ${video.title}`);

      window.dispatchEvent(
        new CustomEvent("youtube-progress", { detail: { index: i, status: "downloading", current: i } })
      );
      pushLog(` ⬇️ Downloading from YouTube...`);

      window.dispatchEvent(new CustomEvent("youtube-progress", { detail: { index: i, status: "uploading" } }));
      pushLog(` ⬆️ Uploading to S3...`);

      const response = await fetch("/api/admin/youtube/download-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ videos: [video] }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = data?.error || `Upload failed (HTTP ${response.status})`;
        throw new Error(msg);
      }

      const result = data?.results?.[0];
      if (!result) throw new Error("Backend returned no results[0]");
      if (!result.success) throw new Error(result.error || "Unknown backend error");

      window.dispatchEvent(new CustomEvent("youtube-progress", { detail: { index: i, status: "saving" } }));
      pushLog(` 💾 Saving to DynamoDB...`);

      window.dispatchEvent(
        new CustomEvent("youtube-progress", {
          detail: { index: i, status: "done", s3Url: result.s3Url, size: result.size || result.sizeMB || undefined },
        })
      );

      pushLog(` ✅ Complete! S3 URL: ${result.s3Url}`);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      pushLog(` ❌ Failed: ${msg}`);
      window.dispatchEvent(new CustomEvent("youtube-progress", { detail: { index: i, status: "error", error: msg } }));
    }
  }

  window.dispatchEvent(new CustomEvent("youtube-progress", { detail: { allDone: true } }));
  pushLog(`\n🎉 All videos processed!`);
}
