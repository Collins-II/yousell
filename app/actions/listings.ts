"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Auction, Bid, Car, Comment, Favourite, Image, Property, isObjectId } from "@/lib/models";
import { getSession } from "@/lib/auth";
import { suggestIncrement } from "@/lib/auctions";
import { getAccount, listingAccess } from "@/lib/accounts";
import { getPlan, FREE_LISTING_LIMIT } from "@/lib/billing";

export type ListingState = { error?: string } | undefined;
type Kind = "property" | "car";

const coord = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(min).max(max).optional());
const optionalNum = (max: number) => z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(max).optional());

const base = {
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(120),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(5000),
  price: z.coerce.number().positive("Enter a valid price").max(1_000_000_000),
  currency: z.enum(["USD", "EUR", "GBP", "ZMW"]),
  country: z.string().trim().min(2, "Enter a country").max(80),
  state: z.string().trim().min(2, "Enter a state or province").max(80),
  suburb: z.string().trim().max(80).optional(),
  lat: coord(-90, 90),
  lng: coord(-180, 180),
  category: z.enum(["Sale", "Rent"]),
  saleMode: z.enum(["fixed", "auction"]).default("fixed"),
  auctionDays: z.coerce.number().int().min(1).max(30).default(7),
  reserve: optionalNum(1_000_000_000),
};

const propertySchema = z.object({
  ...base,
  bedrooms: z.coerce.number().int().min(0).max(50),
  bathrooms: z.coerce.number().int().min(0).max(50),
  size: optionalNum(1_000_000),
});

const carSchema = z.object({
  ...base,
  make: z.string().trim().min(2, "Enter the make").max(60),
  carModel: z.string().trim().min(1, "Enter the model").max(60),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  mileage: z.coerce.number().min(0).max(5_000_000),
  fuel: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID"]),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]),
});

type Data = z.infer<typeof propertySchema> & z.infer<typeof carSchema>;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const path = (kind: Kind, id: unknown) => `/${kind === "property" ? "properties" : "cars"}/${id}`;
const IMAGE_PATH = /^\/api\/images\/([a-f\d]{24})$/i;

function parse(kind: Kind, raw: Record<string, FormDataEntryValue>) {
  const res = kind === "property" ? propertySchema.safeParse(raw) : carSchema.safeParse(raw);
  return res.success ? { data: res.data as Data } : { error: res.error.issues[0].message };
}

// New images must be our own uploads owned by the caller; images already on the listing are kept as-is
async function resolveImages(formData: FormData, userId: string, existing: string[] = []) {
  const urls = [...new Set(formData.getAll("images").map(String).filter(Boolean))].slice(0, 12);
  const uploads = urls.map((u) => IMAGE_PATH.exec(u)?.[1]).filter((v): v is string => Boolean(v));
  const owned = uploads.length ? await Image.find({ _id: { $in: uploads }, ownerId: userId }).select("_id").lean<{ _id: unknown }[]>() : [];
  const ownedSet = new Set(owned.map((o) => String(o._id)));
  return urls.filter((u) => {
    if (existing.includes(u)) return true;
    const id = IMAGE_PATH.exec(u)?.[1];
    return Boolean(id && ownedSet.has(id));
  });
}

const address = (d: Data) => ({ country: d.country, state: d.state, state_district: d.state, suburb: d.suburb ?? "", street: "" });
const mapOf = (d: Data) => (d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : undefined);

export async function createListing(_: ListingState, formData: FormData): Promise<ListingState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in to create a listing" };

  const kind = formData.get("kind");
  if (kind !== "property" && kind !== "car") return { error: "Choose a listing type" };
  const parsed = parse(kind, Object.fromEntries(formData));
  if (!parsed.data) return { error: parsed.error };
  const d = parsed.data;

  await connectDb();
  const account = await getAccount(session.id);
  if (!account) return { error: "Account not found" };
  const access = listingAccess(account);
  if (!access.ok) return { error: access.reason };
  const plan = await getPlan(session.id);
  if (!plan.isPro && plan.used >= FREE_LISTING_LIMIT) {
    return { error: `Free accounts can have ${FREE_LISTING_LIMIT} active listings. Upgrade to Pro for unlimited listings.` };
  }
  const isAuction = d.saleMode === "auction" && d.category === "Sale";
  const images = await resolveImages(formData, session.id);
  const common = {
    author: session.id,
    title: d.title,
    description: d.description,
    currency: d.currency,
    featuredImage: images[0] ?? "",
    galleryImgs: images,
    address: address(d),
    map: mapOf(d),
    isFeatured: plan.isPro,
  };

  const doc =
    kind === "property"
      ? await Property.create({
          ...common,
          date: new Date().toISOString(),
          propertySize: d.size ?? 0,
          rentalForm: "Property",
          price: String(d.price),
          listingCategory: d.category,
          listingType: "Property",
          bedrooms: d.bedrooms,
          bathrooms: d.bathrooms,
          maxGuests: Math.max(1, d.bedrooms * 2),
        })
      : await Car.create({
          ...common,
          slug: `${slugify(d.title)}-${Date.now().toString(36)}`,
          year: d.year,
          odoReading: d.mileage,
          odoUnit: "KILOMETERS",
          price: d.price,
          make: d.make,
          carModel: d.carModel,
          fuelType: d.fuel,
          transmission: d.transmission,
          status: "LIVE",
          listingCategory: d.category.toUpperCase(),
          listingType: "Car",
          isAuction,
        });

  if (isAuction) {
    await Auction.create({
      kind,
      listingId: doc._id,
      sellerId: session.id,
      currency: d.currency,
      startingBid: d.price,
      reservePrice: d.reserve ?? 0,
      minIncrement: suggestIncrement(d.price),
      endsAt: new Date(Date.now() + d.auctionDays * 86_400_000),
    });
  }
  redirect(path(kind, doc._id));
}

export async function updateListing(_: ListingState, formData: FormData): Promise<ListingState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in" };
  const kind = formData.get("kind");
  const id = String(formData.get("id") ?? "");
  if ((kind !== "property" && kind !== "car") || !isObjectId(id)) return { error: "Listing not found" };

  const parsed = parse(kind, Object.fromEntries(formData));
  if (!parsed.data) return { error: parsed.error };
  const d = parsed.data;

  await connectDb();
  const model = kind === "property" ? Property : Car;
  const existing = await model.findOne({ _id: id, author: session.id }).lean<{ galleryImgs?: string[]; featuredImage?: string }>();
  if (!existing) return { error: "Listing not found" };

  const auction = await Auction.findOne({ kind, listingId: id }).lean<{ status: string; bidCount?: number }>();
  const live = auction?.status === "live";
  const locked = live && (auction?.bidCount ?? 0) > 0;
  const images = await resolveImages(formData, session.id, [existing.featuredImage ?? "", ...(existing.galleryImgs ?? [])]);

  const common = {
    title: d.title,
    description: d.description,
    featuredImage: images[0] ?? "",
    galleryImgs: images,
    address: address(d),
    map: mapOf(d) ?? null,
  };
  // Price, currency and category are frozen once bidding has started
  const pricing = locked ? {} : { currency: d.currency, listingCategory: kind === "car" ? d.category.toUpperCase() : d.category };

  if (kind === "property") {
    await Property.updateOne(
      { _id: id },
      { $set: { ...common, ...pricing, ...(locked ? {} : { price: String(d.price) }), propertySize: d.size ?? 0, bedrooms: d.bedrooms, bathrooms: d.bathrooms, maxGuests: Math.max(1, d.bedrooms * 2) } },
    );
  } else {
    await Car.updateOne(
      { _id: id },
      { $set: { ...common, ...pricing, ...(locked ? {} : { price: d.price }), make: d.make, carModel: d.carModel, year: d.year, odoReading: d.mileage, fuelType: d.fuel, transmission: d.transmission } },
    );
  }
  if (live && !locked) {
    await Auction.updateOne({ kind, listingId: id }, { $set: { startingBid: d.price, currency: d.currency, minIncrement: suggestIncrement(d.price) } });
  }
  revalidatePath(path(kind, id));
  revalidatePath("/dashboard");
  redirect(path(kind, id));
}

export async function deleteListing(kind: Kind, id: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Please sign in" };
  if ((kind !== "property" && kind !== "car") || !isObjectId(id)) return { error: "Listing not found" };

  await connectDb();
  const model = kind === "property" ? Property : Car;
  if (!(await model.exists({ _id: id, author: session.id }))) return { error: "Listing not found" };

  const auction = await Auction.findOne({ kind, listingId: id }).lean<{ _id: unknown; status: string; bidCount?: number }>();
  if (auction?.status === "live" && (auction.bidCount ?? 0) > 0) {
    return { error: "This auction already has bids and can't be deleted until it ends." };
  }
  if (auction) await Promise.all([Auction.deleteOne({ _id: auction._id }), Bid.deleteMany({ auctionId: auction._id })]);
  await Promise.all([model.deleteOne({ _id: id, author: session.id }), Favourite.deleteMany({ kind, listingId: id }), Comment.deleteMany({ kind, listingId: id })]);
  revalidatePath("/dashboard");
  revalidatePath(kind === "property" ? "/properties" : "/cars");
  return {};
}
