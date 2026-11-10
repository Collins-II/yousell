import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isObjectId } from "@/lib/models";
import { refreshPayment } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const headers = { "Cache-Control": "no-store" };
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (!isObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const result = await refreshPayment(id, session.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  return NextResponse.json(result, { headers });
}
