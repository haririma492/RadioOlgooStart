// app/api/admin/youtube/fetch-videos/route.ts
// Pure Node.js implementation using ytdl-core
import { NextRequest, NextResponse } from "next/server";
import ytdl from "ytdl-core";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Helper to extract channel handle from URL
function extractChannelHandle(url: string): string | null {
  const match = url.match(/@([^/?]+)/);
  return match ? match[1] : null;
}

// Helper to get channel ID from handle
async function getChannelId(handle: string): Promise<string | null> {
  try {
    // Use YouTube page to get channel ID
    const channelUrl = `https://www.youtube.com/@${handle}`;
    console.log(`Fetching channel page: ${channelUrl}`);
    
    const response = await fetch(channelUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch channel page: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract channel ID from page HTML - try multiple patterns
    const patterns = [
      /"channelId":"([^"]+)"/,
      /"externalId":"([^"]+)"/,
      /channel_id=([^&"]+)/,
      /"browseId":"([^"]+)"/
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        console.log(`Found channel ID: ${match[1]}`);
        return match[1];
      }
    }
    
    console.error("Could not find channel ID in page HTML");
    return null;
  } catch (error) {
    console.error("Error getting channel ID:", error);
    return null;
  }
}

// Helper to get videos from channel using RSS feed
async function getChannelVideos(channelId: string): Promise<any[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    console.log(`Fetching RSS feed: ${rssUrl}`);
    
    const response = await fetch(rssUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
      throw new Error(`RSS feed request failed: ${response.status}`);
    }
    
    const xmlText = await response.text();
    console.log(`RSS feed length: ${xmlText.length} characters`);
    
    // Parse RSS XML
    const entries: any[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const matches = Array.from(xmlText.matchAll(entryRegex));
    
    console.log(`Found ${matches.length} video entries in RSS feed`);
    
    for (const match of matches) {
      const entry = match[1];
      
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      const channelName = entry.match(/<name>([^<]+)<\/name>/)?.[1];
      
      if (videoId && title) {
        console.log(`  - Video: ${videoId} - ${title?.substring(0, 50)}`);
        entries.push({
          videoId,
          title: decodeHTMLEntities(title),
          uploadDate: formatDate(published),
          channelTitle: decodeHTMLEntities(channelName || "Unknown"),
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
      
      if (entries.length >= 5) break;
    }
    
    console.log(`Returning ${entries.length} videos from RSS feed`);
    return entries;
  } catch (error) {
    console.error("Error fetching channel videos:", error);
    throw error;
  }
}

// Helper to get video details (views, duration)
async function getVideoDetails(videoId: string): Promise<any> {
  try {
    const info = await ytdl.getInfo(videoId);
    
    return {
      viewCount: parseInt(info.videoDetails.viewCount) || 0,
      duration: parseInt(info.videoDetails.lengthSeconds) || 0,
    };
  } catch (error) {
    console.error(`Error getting details for video ${videoId}:`, error);
    return {
      viewCount: 0,
      duration: 0,
    };
  }
}

// Helper to decode HTML entities
function decodeHTMLEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  
  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

// Helper to format date
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Unknown";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const adminToken = request.headers.get("x-admin-token");
    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { channels } = body;

    if (!channels || !Array.isArray(channels)) {
      return NextResponse.json(
        { error: "Invalid request: channels array required" },
        { status: 400 }
      );
    }

    const allVideos: any[] = [];

    console.log(`\n=== Processing ${channels.length} channel(s) ===\n`);

    // Process each channel
    for (const channel of channels) {
      const { url, group } = channel;

      if (!url || !group) {
        console.log(`Skipping channel: missing URL or group`);
        continue;
      }

      try {
        console.log(`\n--- Processing channel: ${url} ---`);
        
        const handle = extractChannelHandle(url);
        if (!handle) {
          console.error(`Invalid channel URL: ${url}`);
          continue;
        }
        
        console.log(`Channel handle: ${handle}`);

        // Get channel ID
        const channelId = await getChannelId(handle);
        if (!channelId) {
          console.error(`Could not get channel ID for: ${handle}`);
          continue;
        }

        // Get videos from channel RSS
        const videos = await getChannelVideos(channelId);

        // Get detailed info for each video
        for (const video of videos) {
          try {
            const details = await getVideoDetails(video.videoId);
            
            allVideos.push({
              ...video,
              ...details,
              group: group,
              channelUrl: url,
              channelHandle: handle,
            });
          } catch (error) {
            console.error(`Error processing video ${video.videoId}:`, error);
            // Add video without details
            allVideos.push({
              ...video,
              viewCount: 0,
              duration: 0,
              group: group,
              channelUrl: url,
              channelHandle: handle,
            });
          }
        }
      } catch (error: any) {
        console.error(`Error fetching channel ${url}:`, error);
        // Continue with other channels even if one fails
      }
    }

    if (allVideos.length === 0) {
      return NextResponse.json(
        { error: "No videos found. Check console logs for details. Make sure the channel has public videos and the URL is correct." },
        { status: 400 }
      );
    }

    console.log(`\n=== Successfully fetched ${allVideos.length} total videos ===\n`);

    return NextResponse.json({
      success: true,
      videos: allVideos,
      count: allVideos.length,
    });
  } catch (error: any) {
    console.error("Error in fetch-videos:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch videos" },
      { status: 500 }
    );
  }
}