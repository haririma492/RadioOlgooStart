// app/api/slides/route.ts
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

const bucket = (process.env.S3_BUCKET_NAME || "").trim(); // needed for GET presign
const bucketHost = bucket ? `${bucket}.s3.${region}.amazonaws.com` : "";

const s3 = new S3Client({ region });

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// If url is https://<bucket>.s3.<region>.amazonaws.com/<key...>
// return <key...>
function keyFromS3PublicUrl(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    if (!bucketHost) return null;
    if (u.hostname !== bucketHost) return null;

    // pathname starts with "/"
    const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return key || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const set = (searchParams.get("set") || "").toUpperCase();

    if (!["SLIDES", "CENTER", "BG"].includes(set)) {
      return json(
        { error: "Invalid set. Use ?set=SLIDES or ?set=CENTER or ?set=BG" },
        400
      );
    }

    const TableName = getEnv("DDB_TABLE_NAME");

    const out = await ddb.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": set },
      })
    );

    const itemsRaw = (out.Items || []) as any[];

const filtered = itemsRaw
  .filter((x) => {
    if (!x || typeof x.url !== "string" || x.url.length === 0) return false;

    // BG: allow even if enabled is missing/false (so one BG still shows)
    if (set === "BG") return true;

    // CENTER/SLIDES: keep your enabled filter
    return x.enabled !== false;
  })

      .sort(
        (a, b) =>
          Number(a.order ?? 0) - Number(b.order ?? 0) ||
          String(a.sk ?? "").localeCompare(String(b.sk ?? ""))
      );

    // If bucket is configured, convert S3 public URLs into GET-presigned URLs
    const items = await Promise.all(
      filtered.map(async (x) => {
        let urlStr = String(x.url || "");

        // If your bucket is private, raw S3 url won't load in browser.
        // Turn it into GET-presigned url when possible.
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
          pk: x.pk,
          sk: x.sk,
          url: urlStr,
          mediaType: x.mediaType || "",
          enabled: x.enabled !== false,
          order: Number(x.order ?? 0),
          category1: x.category1 ?? "",
          category2: x.category2 ?? "",
          description: x.description ?? "",
          createdAt: x.createdAt ?? "",
        };
      })
    );

    return json({ ok: true, set, count: items.length, items });
  } catch (e: any) {
    return json({ error: "Server error", detail: e?.message || String(e) }, 500);
  }
}
