import "server-only";
import type { PipelineStage } from "mongoose";
import { connectDb } from "./db";
import { Auction, Car, Favourite, Property, isObjectId } from "./models";
import { withAuctions, type AuctionInfo } from "./auctions";
import { regionNamePattern } from "./region-normalization";
import { getReservedIds } from "./reservations";

export type Kind = "property" | "car";

export type Listing = {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  image: string | null;
  images: string[];
  location: string;
  featured: boolean;
  facts: { label: string; value: string }[];
  highlights: string[];
  authorId: string | null;
  map: { lat: number; lng: number } | null;
  auction: AuctionInfo | null;
  reserved: boolean;
};

export type Filters = {
  q?: string;
  category?: string;
  min?: number;
  max?: number;
  beds?: number;
  make?: string;
  fuel?: string;
  transmission?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  page?: number;
};

export const PAGE_SIZE = 12;

type Raw = Record<string, unknown> & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const title = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "");

function location(address?: Raw) {
  return [address?.suburb, address?.state_district, address?.state, address?.country]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
    .join(", ");
}

function images(doc: Raw) {
  const all = [doc.featuredImage, ...(doc.galleryImgs ?? [])].filter(
    (u): u is string => typeof u === "string" && /^(https?:\/\/|\/api\/images\/)/.test(u),
  );
  return [...new Set(all)];
}

export function toProperty(doc: Raw): Listing {
  const imgs = images(doc);
  return {
    id: String(doc._id),
    kind: "property",
    title: doc.title,
    description: doc.description ?? "",
    price: Number.parseFloat(String(doc.price).replace(/[^\d.]/g, "")) || 0,
    currency: doc.currency ?? "USD",
    category: doc.listingCategory ?? "Sale",
    image: imgs[0] ?? null,
    images: imgs,
    location: location(doc.address),
    featured: Boolean(doc.isFeatured || doc.premiumSubscription),
    facts: [
      { label: "Bedrooms", value: String(doc.bedrooms ?? 0) },
      { label: "Bathrooms", value: String(doc.bathrooms ?? 0) },
      { label: "Guests", value: String(doc.maxGuests ?? 0) },
      ...(doc.propertySize ? [{ label: "Size", value: `${doc.propertySize} m²` }] : []),
      ...(doc.rentalForm ? [{ label: "Type", value: doc.rentalForm }] : []),
    ],
    highlights: doc.amenities ?? [],
    authorId: doc.author ? String(doc.author) : null,
    map: doc.map?.lat != null ? { lat: doc.map.lat, lng: doc.map.lng } : null,
    auction: null,
    reserved: false,
  };
}

export function toCar(doc: Raw): Listing {
  const imgs = images(doc);
  return {
    id: String(doc._id),
    kind: "car",
    title: doc.title || `${doc.make} ${doc.carModel ?? ""}`.trim(),
    description: doc.description ?? "",
    price: Number(doc.price) || 0,
    currency: doc.currency ?? "USD",
    category: title(doc.listingCategory) || "Sale",
    image: imgs[0] ?? null,
    images: imgs,
    location: location(doc.address),
    featured: Boolean(doc.isFeatured),
    facts: [
      { label: "Year", value: String(doc.year) },
      { label: "Mileage", value: `${(doc.odoReading ?? 0).toLocaleString("en-US")} ${title(doc.odoUnit) === "Miles" ? "mi" : "km"}` },
      { label: "Fuel", value: title(doc.fuelType) },
      { label: "Gearbox", value: title(doc.transmission) },
      { label: "Body", value: title(doc.bodyType) },
      { label: "Colour", value: title(doc.colour) },
      { label: "Doors", value: String(doc.doors ?? "") },
      { label: "Seats", value: String(doc.seats ?? "") },
    ].filter((f) => f.value),
    highlights: [],
    authorId: doc.author ? String(doc.author) : null,
    map: doc.map?.lat != null ? { lat: doc.map.lat, lng: doc.map.lng } : null,
    auction: null,
    reserved: false,
  };
}

function sortStage(sort: Filters["sort"]): Record<string, 1 | -1> {
  if (sort === "price_asc") return { priceNum: 1, _id: -1 };
  if (sort === "price_desc") return { priceNum: -1, _id: -1 };
  return { _id: -1 };
}

function priceMatch(f: Filters) {
  const range: Record<string, number> = {};
  if (f.min != null) range.$gte = f.min;
  if (f.max != null) range.$lte = f.max;
  return Object.keys(range).length ? { priceNum: range } : {};
}

function textMatch(q?: string) {
  if (!q) return {};
  const rx = new RegExp(escapeRegex(q.trim().slice(0, 80)), "i");
  return { $or: [{ title: rx }, { "address.suburb": rx }, { "address.state": rx }, { "address.state_district": rx }, { "address.country": rx }, { make: rx }, { carModel: rx }] };
}

export async function searchListings(kind: Kind, f: Filters) {
  await connectDb();
  const page = Math.max(1, f.page ?? 1);
  const reserved = await getReservedIds(kind);
  const match: Raw = { ...textMatch(f.q), ...priceMatch(f), suspended: { $ne: true } };
  if (reserved.length) match._id = { $nin: reserved };
  if (f.category) match.listingCategory = kind === "car" ? f.category.toUpperCase() : f.category;

  if (kind === "property") {
    if (f.beds) match.bedrooms = { $gte: f.beds };
    match.status = { $nin: ["SOLD", "RENTED"] };
  } else {
    match.status = { $nin: ["SOLD", "PURCHASED"] };
    if (f.make) match.make = new RegExp(`^${escapeRegex(f.make)}$`, "i");
    if (f.fuel) match.fuelType = f.fuel.toUpperCase();
    if (f.transmission) match.transmission = f.transmission.toUpperCase();
  }

  const { priceNum, ...rest } = match;
  const pipeline: PipelineStage[] = [
    { $addFields: { priceNum: { $convert: { input: "$price", to: "double", onError: 0, onNull: 0 } } } },
    { $match: { ...rest, ...(priceNum ? { priceNum } : {}) } },
    { $sort: sortStage(f.sort) },
    {
      $facet: {
        items: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
        total: [{ $count: "n" }],
      },
    },
  ];

  const model = kind === "property" ? Property : Car;
  const [res] = await model.aggregate(pipeline);
  const items = await withAuctions((res?.items ?? []).map(kind === "property" ? toProperty : toCar) as Listing[]);
  const total: number = res?.total?.[0]?.n ?? 0;
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getListing(kind: Kind, id: string): Promise<Listing | null> {
  if (!isObjectId(id)) return null;
  await connectDb();
  const model = kind === "property" ? Property : Car;
  const doc = await model.findById(id).lean();
  if (!doc) return null;
  const [listing] = await withAuctions([(kind === "property" ? toProperty(doc) : toCar(doc)) as Listing]);
  return listing;
}

export async function getLatest(kind: Kind, limit = 4) {
  await connectDb();
  const model = kind === "property" ? Property : Car;
  const reserved = await getReservedIds(kind);
  const filter = { ...(kind === "car" ? { status: { $nin: ["SOLD", "PURCHASED"] } } : { status: { $nin: ["SOLD", "RENTED"] } }), ...(reserved.length ? { _id: { $nin: reserved } } : {}) };
  const docs = await model.find(filter).sort({ _id: -1 }).limit(limit).lean();
  return withAuctions(docs.map(kind === "property" ? toProperty : toCar) as Listing[]);
}

export async function getCounts() {
  await connectDb();
  const [reservedProps, reservedCars] = await Promise.all([getReservedIds("property"), getReservedIds("car")]);
  const [properties, cars] = await Promise.all([
    Property.countDocuments({ status: { $nin: ["SOLD", "RENTED"] }, _id: { $nin: reservedProps } }),
    Car.countDocuments({ status: { $nin: ["SOLD", "PURCHASED"] }, _id: { $nin: reservedCars } }),
  ]);
  return { properties, cars };
}

export async function getFavouriteKeys(userId?: string | null) {
  if (!userId) return new Set<string>();
  await connectDb();
  const docs = await Favourite.find({ userId }).lean<{ kind: Kind; listingId: unknown }[]>();
  return new Set(docs.map((d) => `${d.kind}:${String(d.listingId)}`));
}

export async function getFavouriteListings(userId: string) {
  await connectDb();
  const docs = await Favourite.find({ userId }).sort({ createdAt: -1 }).lean<{ kind: Kind; listingId: unknown }[]>();
  const ids = (kind: Kind) => docs.filter((d) => d.kind === kind).map((d) => d.listingId);
  const [props, cars] = await Promise.all([
    Property.find({ _id: { $in: ids("property") } }).lean(),
    Car.find({ _id: { $in: ids("car") } }).lean(),
  ]);
  return withAuctions([...props.map(toProperty), ...cars.map(toCar)] as Listing[]);
}

export async function getMyListings(userId: string) {
  await connectDb();
  const [props, cars] = await Promise.all([
    Property.find({ author: userId }).sort({ _id: -1 }).lean(),
    Car.find({ author: userId }).sort({ _id: -1 }).lean(),
  ]);
  return withAuctions([...props.map(toProperty), ...cars.map(toCar)] as Listing[]);
}

/** Public, open listings by one seller: no suspended, closed or reserved items. */
export async function getAgentListings(authorId: string, limit = 24) {
  if (!isObjectId(authorId)) return [];
  await connectDb();
  const [reservedProps, reservedCars] = await Promise.all([getReservedIds("property"), getReservedIds("car")]);
  const open = { author: authorId, suspended: { $ne: true } };
  const [props, cars] = await Promise.all([
    Property.find({ ...open, status: { $nin: ["SOLD", "RENTED"] }, _id: { $nin: reservedProps } }).sort({ _id: -1 }).limit(limit).lean(),
    Car.find({ ...open, status: { $nin: ["SOLD", "PURCHASED"] }, _id: { $nin: reservedCars } }).sort({ _id: -1 }).limit(limit).lean(),
  ]);
  return withAuctions([...props.map(toProperty), ...cars.map(toCar)] as Listing[]);
}

export { formatPrice } from "./format";

export async function getMapListings(kind: Kind | "all", q?: string, limit = 400, region?: { country: string; state: string }) {
  await connectDb();
  const filter: Raw = {
    "map.lat": { $ne: null },
    "map.lng": { $ne: null },
    ...textMatch(q),
    ...(region ? { "address.country": regionNamePattern(region.country), "address.state": regionNamePattern(region.state) } : {}),
  };
  const [reservedProps, reservedCars] = await Promise.all([getReservedIds("property"), getReservedIds("car")]);
  const carFilter = { ...filter, status: { $nin: ["SOLD", "PURCHASED"] }, _id: { $nin: reservedCars } };
  const [props, cars] = await Promise.all([
    kind === "car" ? [] : Property.find({ ...filter, status: { $nin: ["SOLD", "RENTED"] }, _id: { $nin: reservedProps } }).sort({ _id: -1 }).limit(limit).lean(),
    kind === "property" ? [] : Car.find(carFilter).sort({ _id: -1 }).limit(limit).lean(),
  ]);
  return withAuctions([...props.map(toProperty), ...cars.map(toCar)] as Listing[]);
}

export type EditableListing = {
  kind: Kind;
  id: string;
  values: Record<string, string | number>;
  images: string[];
  auction: AuctionInfo | null;
};

export async function getEditable(kind: Kind, id: string, userId: string): Promise<EditableListing | null> {
  if (!isObjectId(id)) return null;
  await connectDb();
  const model = kind === "property" ? Property : Car;
  const doc = await model.findOne({ _id: id, author: userId }).lean<Raw>();
  if (!doc) return null;
  const listing = (await withAuctions([(kind === "property" ? toProperty(doc) : toCar(doc)) as Listing]))[0];
  const values: EditableListing["values"] = {
    title: doc.title ?? "",
    description: doc.description ?? "",
    category: kind === "car" ? title(doc.listingCategory) || "Sale" : doc.listingCategory ?? "Sale",
    price: Number.parseFloat(String(doc.price)) || 0,
    currency: doc.currency ?? "USD",
    country: doc.address?.country ?? "",
    state: doc.address?.state ?? "",
    suburb: doc.address?.suburb ?? "",
    lat: doc.map?.lat ?? "",
    lng: doc.map?.lng ?? "",
  };
  if (kind === "property") Object.assign(values, { bedrooms: doc.bedrooms ?? 0, bathrooms: doc.bathrooms ?? 0, size: doc.propertySize ?? "" });
  else Object.assign(values, { make: doc.make ?? "", carModel: doc.carModel ?? "", year: doc.year, mileage: doc.odoReading ?? 0, fuel: doc.fuelType ?? "PETROL", transmission: doc.transmission ?? "AUTOMATIC" });
  return { kind, id, values, images: listing.images, auction: listing.auction };
}
export async function getLiveAuctions(limit = 48) {
  await connectDb();
  const auctions = await Auction.find({ status: "live", endsAt: { $gt: new Date() } }).sort({ endsAt: 1 }).limit(limit).lean<{ kind: Kind; listingId: unknown }[]>();
  const ids = (kind: Kind) => auctions.filter((a) => a.kind === kind).map((a) => a.listingId);
  const [props, cars] = await Promise.all([Property.find({ _id: { $in: ids("property") } }).lean(), Car.find({ _id: { $in: ids("car") } }).lean()]);
  const items = await withAuctions([...props.map(toProperty), ...cars.map(toCar)] as Listing[]);
  return items.filter((l) => l.auction?.status === "live").sort((a, b) => a.auction!.endsAt.localeCompare(b.auction!.endsAt));
}