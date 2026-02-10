// Original: app\api\admin\envcheck\route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasAdminToken: Boolean(process.env.ADMIN_TOKEN),
    adminTokenLength: process.env.ADMIN_TOKEN?.length ?? 0,
    adminTokenPrefix: (process.env.ADMIN_TOKEN ?? "").slice(0, 6), // safe
  });
}
