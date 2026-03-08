/**
 * scripts/backfill-channel-ids.mjs
 *
 * One-time script to add YouTube channelId to existing DynamoDB media records.
 *
 * Run: node scripts/backfill-channel-ids.mjs
 *
 * Requires .env.local with:
 *   YOUTUBE_API_KEY=...
 *   DDB_TABLE_NAME=...  (or DYNAMODB_TABLE or TABLE_NAME)
 *   AWS_REGION=... (optional, defaults to ca-central-1)
 *   AWS_ACCESS_KEY_ID=...
 *   AWS_SECRET_ACCESS_KEY=...
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv(path = ".env.local") {
    try {
        const content = readFileSync(resolve(process.cwd(), path), "utf-8");
        for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eq = trimmed.indexOf("=");
            if (eq < 0) continue;
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            // Strip surrounding quotes
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = value;
        }
    } catch (e) {
        console.warn(`⚠️  Could not load ${path}:`, e.message);
    }
}

loadEnv();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const TABLE_NAME =
    process.env.DDB_TABLE_NAME ||
    process.env.DYNAMODB_TABLE ||
    process.env.TABLE_NAME;
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";

if (!YOUTUBE_API_KEY) { console.error("❌ Missing YOUTUBE_API_KEY"); process.exit(1); }
if (!TABLE_NAME) { console.error("❌ Missing DDB_TABLE_NAME / DYNAMODB_TABLE / TABLE_NAME"); process.exit(1); }

const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION }),
    { marshallOptions: { removeUndefinedValues: true } }
);

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractHandle(url) {
    const s = (url || "").trim();
    const m1 = s.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
    if (m1?.[1]) return m1[1];
    const m2 = s.match(/youtube\.com\/(?:c|user)\/([A-Za-z0-9._-]+)/i);
    if (m2?.[1]) return m2[1];
    return null;
}

function extractDirectChannelId(url) {
    const m = (url || "").match(/\/channel\/(UC[A-Za-z0-9_-]+)/i);
    return m?.[1] || null;
}

function isYouTubeUrl(url) {
    return /youtube\.com|youtu\.be/i.test(url || "");
}

async function resolveChannelId(handle) {
    const apiUrl =
        `https://www.googleapis.com/youtube/v3/channels` +
        `?part=id&forHandle=${encodeURIComponent("@" + handle)}` +
        `&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

    const res = await fetch(apiUrl);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = json?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    const channelId = json?.items?.[0]?.id;
    return typeof channelId === "string" && channelId.startsWith("UC") ? channelId : null;
}

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🔍 Scanning DynamoDB table: ${TABLE_NAME} (region: ${REGION})\n`);

    // 1. Scan all items
    const allItems = [];
    let lastKey;
    do {
        const out = await ddb.send(new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey: lastKey }));
        if (out.Items?.length) allItems.push(...out.Items);
        lastKey = out.LastEvaluatedKey;
    } while (lastKey);

    console.log(`📦 Total items in table: ${allItems.length}`);

    // 2. Filter: YouTube URLs missing channelId
    const targets = allItems.filter(
        (it) => isYouTubeUrl(it.url) && !it.channelId
    );

    console.log(`🎯 YouTube items missing channelId: ${targets.length}\n`);

    if (targets.length === 0) {
        console.log("✅ All YouTube items already have channelId. Nothing to do!");
        return;
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of targets) {
        const pk = item.PK;
        const url = item.url;

        // Try direct channelId from URL first (free)
        const directId = extractDirectChannelId(url);
        if (directId) {
            await ddb.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: pk },
                UpdateExpression: "SET channelId = :cid, updatedAt = :now",
                ExpressionAttributeValues: { ":cid": directId, ":now": new Date().toISOString() },
            }));
            console.log(`✅ ${pk} → channelId: ${directId} (from URL)`);
            updated++;
            continue;
        }

        // Resolve via handle
        const handle = extractHandle(url);
        if (!handle) {
            console.log(`⚠️  ${pk} → Could not extract handle from: ${url}`);
            skipped++;
            continue;
        }

        try {
            // Throttle: avoid hitting API too fast
            await sleep(200);

            const channelId = await resolveChannelId(handle);
            if (channelId) {
                await ddb.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: pk },
                    UpdateExpression: "SET channelId = :cid, updatedAt = :now",
                    ExpressionAttributeValues: { ":cid": channelId, ":now": new Date().toISOString() },
                }));
                console.log(`✅ ${pk} → @${handle} → channelId: ${channelId}`);
                updated++;
            } else {
                console.log(`⚠️  ${pk} → @${handle} → Channel not found via API`);
                skipped++;
            }
        } catch (e) {
            console.error(`❌ ${pk} → @${handle} → Error: ${e.message}`);
            errors++;
        }
    }

    console.log(`\n─────────────────────────────────`);
    console.log(`✅ Updated : ${updated}`);
    console.log(`⚠️  Skipped : ${skipped}`);
    console.log(`❌ Errors  : ${errors}`);
    console.log(`─────────────────────────────────`);
    console.log(`\n🎉 Done! Quota used: ~${updated} units (channels.list)\n`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
