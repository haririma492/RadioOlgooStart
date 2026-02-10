// lib/timeUtils.ts

/**
 * Converts an ISO timestamp to a relative time string
 * Examples:
 * - "just now" (< 1 minute)
 * - "5 minutes ago"
 * - "2 hours ago"
 * - "3 days ago"
 * - "2 months ago"
 */
export function getRelativeTime(isoTimestamp: string): string {
    if (!isoTimestamp) return "";

    try {
        const now = new Date();
        const then = new Date(isoTimestamp);
        const diffMs = now.getTime() - then.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffMonths = Math.floor(diffDays / 30);

        if (diffSeconds < 60) {
            return "just now";
        } else if (diffMinutes < 60) {
            return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
        } else if (diffDays < 30) {
            return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
        } else {
            return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
        }
    } catch (error) {
        console.error("Error parsing timestamp:", error);
        return "";
    }
}
