// Original: app\api\photos\route.ts
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ center: [], bg: [] });
}
