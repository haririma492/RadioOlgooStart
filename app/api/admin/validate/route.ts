import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token")?.trim();
  const expected = process.env.ADMIN_TOKEN?.trim();

  if (!token || !expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (token !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
