import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Image } from "@/lib/models";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_PER_USER = 300;

// Trust the bytes, not the client-supplied MIME type
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to upload photos" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "Photos must be under 6 MB" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniff(bytes);
  if (!contentType) return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF image" }, { status: 415 });

  await connectDb();
  if ((await Image.countDocuments({ ownerId: session.id })) >= MAX_PER_USER) {
    return NextResponse.json({ error: "Upload limit reached" }, { status: 429 });
  }
  const doc = await Image.create({ ownerId: session.id, contentType, size: bytes.byteLength, data: Buffer.from(bytes) });
  return NextResponse.json({ url: `/api/images/${doc._id}` });
}
