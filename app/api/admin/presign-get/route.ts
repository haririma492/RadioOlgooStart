export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const Bucket = process.env.S3_BUCKET_NAME;
    if (!Bucket) return NextResponse.json({ error: "Missing S3_BUCKET_NAME" }, { status: 500 });

    const cmd = new GetObjectCommand({ Bucket, Key: key });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 }); // 60 seconds

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "presign failed" }, { status: 500 });
  }
}
