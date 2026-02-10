// app/api/media/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
    return new NextResponse(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
        },
    });
}

function getEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing ${name} in env`);
    return v;
}

const region =
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1";

const bucket = (process.env.S3_BUCKET_NAME || "").trim();
const bucketHost = bucket ? `${bucket}.s3.${region}.amazonaws.com` : "";

const s3 = new S3Client({ region });

const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region }),
    { marshallOptions: { removeUndefinedValues: true } }
);

// Extract S3 key from public URL
function keyFromS3PublicUrl(urlStr: string): string | null {
    try {
        const u = new URL(urlStr);
        if (!bucketHost) return null;
        if (u.hostname !== bucketHost) return null;
        const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
        return key || null;
    } catch {
        return null;
    }
}

export async function GET(req: Request) {
    try {
        const TableName = getEnv("DDB_TABLE_NAME");

        // Scan DynamoDB for all items with PK starting with "MEDIA#"
        const out = await ddb.send(
            new ScanCommand({
                TableName,
                FilterExpression: "begins_with(PK, :prefix)",
                ExpressionAttributeValues: { ":prefix": "MEDIA#" },
            })
        );

        const itemsRaw = (out.Items || []) as any[];

        // Filter and sort items
        const filtered = itemsRaw
            .filter((x) => {
                if (!x || typeof x.url !== "string" || x.url.length === 0) return false;
                return true;
            })
            .sort((a, b) => {
                // Sort by createdAt descending (newest first)
                const dateA = a.createdAt || "";
                const dateB = b.createdAt || "";
                return dateB.localeCompare(dateA);
            });

        // Generate presigned URLs for S3 objects
        const items = await Promise.all(
            filtered.map(async (x) => {
                let urlStr = String(x.url || "");

                // Generate presigned URL if bucket is configured
                if (bucket) {
                    const key = (typeof x.s3Key === "string" && x.s3Key.trim())
                        ? x.s3Key.trim()
                        : keyFromS3PublicUrl(urlStr);

                    if (key) {
                        urlStr = await getSignedUrl(
                            s3,
                            new GetObjectCommand({ Bucket: bucket, Key: key }),
                            { expiresIn: 60 * 60 } // 1 hour
                        );
                    }
                }

                return {
                    PK: x.PK,
                    url: urlStr,
                    section: x.section ?? "",
                    group: x.group ?? "",
                    person: x.person ?? "",
                    title: x.title ?? "",
                    description: x.description ?? "",
                    date: x.date ?? "",
                    createdAt: x.createdAt ?? "",
                    updatedAt: x.updatedAt ?? "",
                };
            })
        );

        return json({ ok: true, count: items.length, items });
    } catch (e: any) {
        return json({ error: "Server error", detail: e?.message || String(e) }, 500);
    }
}
