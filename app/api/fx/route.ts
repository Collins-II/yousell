import { getRates } from "@/lib/fx";

export async function GET() {
  const rates = await getRates();
  return Response.json(rates, { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } });
}