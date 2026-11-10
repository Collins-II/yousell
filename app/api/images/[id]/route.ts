import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Image, isObjectId } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isObjectId(id)) return new NextResponse("Not found", { status: 404 });
  await connectDb();
  const img = await Image.findById(id).select("contentType data").lean<{ contentType: string; data: Uint8Array }>();
  if (!img) return new NextResponse("Not found", { status: 404 });
  const bytes = new Uint8Array(img.data);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": img.contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
