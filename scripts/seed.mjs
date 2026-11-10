import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const env = {};
for (const line of fs.readFileSync(path.resolve(".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const uri = env.MONGODB_URL || env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URL missing in .env");
if (env.MONGODB_DNS_SERVERS) dns.setServers(env.MONGODB_DNS_SERVERS.split(",").map((s) => s.trim()));

await mongoose.connect(uri, { dbName: "yousell" });
const col = (n) => mongoose.connection.collection(n);
const reset = process.argv.includes("--reset");

const seededUsers = await col("users").find({ email: /@(zamvault|yousell)\.demo$/ }).project({ _id: 1 }).toArray();
const seededIds = seededUsers.map((u) => u._id);

// Seed rows are removed by the `seed` marker; older demo users and their rows are removed by owner.
for (const n of ["properties", "cars", "favourites", "ys_auctions", "ys_bids", "ys_conversations", "ys_messages", "ys_reservations", "ys_payments"]) {
  await col(n).deleteMany({ seed: true });
}
await col("properties").deleteMany({ author: { $in: seededIds } });
await col("cars").deleteMany({ author: { $in: seededIds } });
await col("users").deleteMany({ email: /@(zamvault|yousell)\.demo$/ });

if (reset) {
  console.log("Seed data removed.");
  await mongoose.disconnect();
  process.exit(0);
}

const now = Date.now();
const H = 3600e3;
const img = (s, n = 3) => Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${s}-${i}/1200/800`);
const hash = await bcrypt.hash("Password123!", 10);

const mkUser = (name, extra = {}) => ({
  name,
  email: `${name.toLowerCase()}@yousell.demo`,
  passwordHash: hash,
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  seed: true,
  ...extra,
});
const ur = await col("users").insertMany([
  mkUser("Amara"),
  mkUser("Tendai"),
  mkUser("Chipo", { subscription: { plan: "pro", status: "active", currentPeriodEnd: new Date(now + 30 * 24 * H) } }),
  mkUser("Buyer"),
  mkUser("Agent", { role: "agent" }),
]);
const [amara, tendai, chipo, buyer, agent] = Object.values(ur.insertedIds);
const owners = [amara, tendai, chipo];

const places = [
  ["Lusaka", "Kabulonga", -15.4167, 28.2833],
  ["Copperbelt", "Kitwe", -12.8024, 28.2132],
  ["Copperbelt", "Ndola", -12.9587, 28.6366],
  ["Southern", "Livingstone", -17.8419, 25.8543],
];
const place = (i) => {
  const [state, suburb, lat, lng, country = "Zambia"] = places[i % places.length];
  return {
    address: { country, state, state_district: suburb, suburb, street: "" },
    map: { lat: lat + (i % 5) * 0.01, lng: lng + (i % 3) * 0.01 },
  };
};
const slugify = (s, i) => `${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-seed${i}`;

const propNames = [
  ["Modern 3-Bed Family Home", 2450000, "Sale", 180],
  ["Luxury Villa with Pool", 6800000, "Sale", 420],
  ["Cosy City Apartment", 14500, "Rent", 75],
  ["Executive Townhouse", 3200000, "Sale", 240],
  ["Riverside Plot", 980000, "Sale", 900],
  ["2-Bed Garden Flat", 9800, "Rent", 85],
  ["Commercial Office Space", 28000, "Rent", 160],
  ["Heritage Colonial House", 1800000, "Sale", 310],
];
const props = propNames.map(([title, price, cat, size], i) => {
  const images = img(`prop${i}`);
  return {
    title,
    description: `${title}. Well maintained, secure neighbourhood, close to schools and shops. Demo listing for testing.`,
    author: owners[i % 3],
    date: new Date(now - i * 20 * H).toISOString(),
    propertySize: size,
    featuredImage: images[0],
    galleryImgs: images,
    amenities: ["Parking", "Security", "Borehole", "Garden"].slice(0, 2 + (i % 3)),
    price: String(price),
    currency: "ZMW",
    listingType: "Property",
    listingCategory: cat,
    bedrooms: i === 4 ? 0 : 2 + (i % 3),
    bathrooms: i === 4 ? 0 : 1 + (i % 3),
    isFeatured: i < 2,
    ...place(i),
    seed: true,
  };
});
const pr = await col("properties").insertMany(props);
const propIds = Object.values(pr.insertedIds);

const carNames = [
  ["Toyota Hilux 2.8 GD-6", "Toyota", "Hilux 2.8 GD-6", 385000, "SALE"],
  ["Toyota Corolla Cross", "Toyota", "Corolla Cross", 295000, "SALE"],
  ["Ford Ranger Wildtrak", "Ford", "Ranger Wildtrak", 520000, "SALE"],
  ["Mazda CX-5", "Mazda", "CX-5", 340000, "SALE"],
  ["Nissan NP200", "Nissan", "NP200", 95000, "SALE"],
  ["Mercedes-Benz C200", "Mercedes-Benz", "C200", 610000, "SALE"],
  ["BMW X3 xDrive", "BMW", "X3 xDrive", 720000, "SALE"],
  ["Toyota Land Cruiser Prado", "Toyota", "Land Cruiser Prado", 8500, "RENT"],
  ["Honda Fit", "Honda", "Fit", 1800, "RENT"],
  ["Isuzu D-Max", "Isuzu", "D-Max", 410000, "SALE"],
];
const cars = carNames.map(([title, make, carModel, price, cat], i) => {
  const images = img(`car${i}`);
  return {
    author: owners[(i + 1) % 3],
    slug: slugify(title, i),
    title,
    description: `${title} in excellent condition with full service history. Demo listing for testing.`,
    year: 2015 + (i % 9),
    odoReading: 20000 + i * 14500,
    odoUnit: "km",
    doors: 4,
    seats: 5,
    price,
    make,
    carModel,
    transmission: i % 2 ? "AUTOMATIC" : "MANUAL",
    fuelType: i % 4 === 0 ? "DIESEL" : "PETROL",
    bodyType: i % 3 === 0 ? "PICKUP" : "SUV",
    colour: ["White", "Black", "Silver", "Grey"][i % 4],
    currency: "ZMW",
    status: "AVAILABLE",
    listingCategory: cat,
    listingType: "Car",
    featuredImage: images[0],
    galleryImgs: images,
    isFeatured: i < 2,
    ...place(i + 1),
    createdAt: new Date(now - i * 15 * H),
    updatedAt: new Date(),
    seed: true,
  };
});
const cr = await col("cars").insertMany(cars);
const carIds = Object.values(cr.insertedIds);

const auctionSpecs = [
  { kind: "car", idx: 0, ends: 3 * H, start: 300000, step: 5000, bids: [305000, 315000, 330000], reserve: 350000 },
  { kind: "car", idx: 2, ends: 30 * H, start: 450000, step: 5000, bids: [460000, 475000] },
  { kind: "car", idx: 3, ends: 72 * H, start: 280000, step: 5000, bids: [] },
  { kind: "car", idx: 5, ends: -6 * H, start: 500000, step: 5000, bids: [510000, 540000], ended: true },
  { kind: "property", idx: 7, ends: 48 * H, start: 1500000, step: 10000, bids: [1520000], reserve: 1800000 },
];
const nameOf = new Map([[amara, "Amara"], [tendai, "Tendai"], [chipo, "Chipo"], [buyer, "Buyer"]].map(([k, v]) => [String(k), v]));
let bidCount = 0;
for (const s of auctionSpecs) {
  const listingId = s.kind === "car" ? carIds[s.idx] : propIds[s.idx];
  const seller = s.kind === "car" ? cars[s.idx].author : props[s.idx].author;
  const bidders = [buyer, tendai, amara, chipo].filter((b) => String(b) !== String(seller));
  const top = s.bids.length ? s.bids[s.bids.length - 1] : 0;
  const high = s.bids.length ? bidders[(s.bids.length - 1) % bidders.length] : null;
  const ar = await col("ys_auctions").insertOne({
    kind: s.kind,
    listingId,
    sellerId: seller,
    currency: "ZMW",
    startingBid: s.start,
    reservePrice: s.reserve ?? 0,
    minIncrement: s.step,
    currentBid: top,
    bidCount: s.bids.length,
    highBidderId: high,
    endsAt: new Date(now + s.ends),
    status: s.ended ? "sold" : "live",
    winnerId: s.ended ? high : null,
    createdAt: new Date(now - 24 * H),
    updatedAt: new Date(),
    seed: true,
  });
  if (s.kind === "car") await col("cars").updateOne({ _id: listingId }, { $set: { isAuction: true, ...(s.ended ? { status: "SOLD" } : {}) } });
  for (const [i, amount] of s.bids.entries()) {
    const bidder = bidders[i % bidders.length];
    await col("ys_bids").insertOne({
      auctionId: ar.insertedId,
      bidderId: bidder,
      bidderName: nameOf.get(String(bidder)),
      amount,
      createdAt: new Date(now - (s.bids.length - i) * H),
      updatedAt: new Date(),
      seed: true,
    });
    bidCount++;
  }
}

// Sample reservations covering the lifecycle: one paid and waiting, one confirmed, one declined and refunded.
const reservationSpecs = [
  { kind: "car", id: carIds[1], doc: cars[1], seller: cars[1].author, status: "held", ref: "YS-DEMO0001", fee: 4425 },
  { kind: "property", id: propIds[5], doc: props[5], seller: props[5].author, status: "confirmed", ref: "YS-DEMO0002", fee: 1470, type: "rent" },
  { kind: "car", id: carIds[4], doc: cars[4], seller: cars[4].author, status: "declined", ref: "YS-DEMO0003", fee: 1425 },
];
for (const r of reservationSpecs) {
  const type = r.type ?? "sale";
  const refunded = r.status === "declined";
  const rid = new mongoose.Types.ObjectId();
  const pid = new mongoose.Types.ObjectId();
  const t = new Date(now - 2 * H);
  await col("ys_payments").insertOne({
    _id: pid,
    reservationId: rid,
    userId: buyer,
    idempotencyKey: `seed-${r.ref}-0000000000`,
    provider: "sandbox",
    network: "airtel",
    msisdnMasked: "+260 97• ••• •67",
    amount: r.fee,
    currency: "ZMW",
    status: refunded ? "refunded" : "succeeded",
    providerRef: `sbx_ok_seed${r.ref.slice(-4)}`,
    settledAt: t,
    createdAt: t,
    updatedAt: t,
    seed: true,
  });
  await col("ys_reservations").insertOne({
    _id: rid,
    reference: r.ref,
    kind: r.kind,
    listingId: r.id,
    listingTitle: r.doc.title,
    listingImage: r.doc.featuredImage,
    type,
    buyerId: buyer,
    buyerName: "Buyer",
    sellerId: r.seller,
    sellerName: nameOf.get(String(r.seller)),
    feeAmount: r.fee,
    feeCurrency: "ZMW",
    status: r.status,
    active: !refunded,
    paymentId: pid,
    paidAt: t,
    history: [
      { at: new Date(now - 2.1 * H), event: "created", by: "Buyer", note: `${type} reservation started` },
      { at: t, event: "paid", by: "system", note: "AIRTEL +260 97• ••• •67" },
      ...(r.status === "confirmed" ? [{ at: new Date(now - H), event: "confirmed", by: "Seller", note: "Confirmed by seller" }] : []),
      ...(refunded ? [{ at: new Date(now - H), event: "declined", by: "Seller", note: "Already sold offline" }] : []),
    ],
    createdAt: new Date(now - 2.1 * H),
    updatedAt: new Date(),
    seed: true,
  });
}

const conv = await col("ys_conversations").insertOne({
  kind: "car",
  listingId: carIds[1],
  listingTitle: cars[1].title,
  listingImage: cars[1].featuredImage,
  sellerId: cars[1].author,
  buyerId: buyer,
  sellerName: nameOf.get(String(cars[1].author)),
  buyerName: "Buyer",
  lastMessage: "Great, see you Saturday at 10am.",
  lastMessageAt: new Date(now - H),
  sellerUnread: 0,
  buyerUnread: 1,
  createdAt: new Date(now - 5 * H),
  updatedAt: new Date(now - H),
  seed: true,
});
const lines = [
  [buyer, "Hi, is the Corolla Cross still available?"],
  [cars[1].author, "Yes it is! Would you like to view it?"],
  [buyer, "Yes please, can I come this weekend?"],
  [cars[1].author, "Great, see you Saturday at 10am."],
];
for (const [i, [sender, body]] of lines.entries()) {
  await col("ys_messages").insertOne({
    conversationId: conv.insertedId,
    senderId: sender,
    body,
    createdAt: new Date(now - (5 - i) * H),
    updatedAt: new Date(now - (5 - i) * H),
    seed: true,
  });
}

await col("favourites").insertMany([
  { userId: buyer, kind: "property", listingId: propIds[1], createdAt: new Date(), updatedAt: new Date(), seed: true },
  { userId: buyer, kind: "car", listingId: carIds[0], createdAt: new Date(), updatedAt: new Date(), seed: true },
]);

console.log(`Seeded: 5 users, ${props.length} properties, ${cars.length} cars, ${auctionSpecs.length} auctions, ${bidCount} bids, ${reservationSpecs.length} reservations.`);
console.log("Logins: buyer|amara|tendai|chipo|agent @yousell.demo  /  Password123!");
void agent;
await mongoose.disconnect();
