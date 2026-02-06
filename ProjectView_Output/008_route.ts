// Original: app\api\admin\validate\route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = (req.headers.get("x-admin-token") || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Missing ADMIN_TOKEN on server" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing x-admin-token header" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  if (token !== expected) {
    return NextResponse.json(
      { ok: false, error: "Invalid token" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
