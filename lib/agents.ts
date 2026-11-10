import "server-only";
import { connectDb } from "./db";
import { Car, Conversation, Favourite, Property, Reservation, User, isObjectId } from "./models";

export type Kind = "property" | "car";
export type Grade = "A+" | "A" | "B+" | "B" | "C" | "D";

export type AgentRank = {
  id: string;
  name: string;
  verified: boolean;
  listings: number;
  sales: number;
  engagement: number;
  responsiveness: number;
  score: number;
  grade: Grade;
};

// Each pillar saturates at its target so one huge number can't drown out the others.
const WEIGHTS = { listings: { points: 35, target: 5 }, sales: { points: 35, target: 3 }, engagement: { points: 20, target: 10 }, responsiveness: { points: 10 } };

const SOLD = ["SOLD", "RENTED", "PURCHASED"];
const grade = (s: number): Grade => (s >= 80 ? "A+" : s >= 65 ? "A" : s >= 50 ? "B+" : s >= 35 ? "B" : s >= 20 ? "C" : "D");
const part = (value: number, w: { points: number; target: number }) => Math.min(1, value / w.target) * w.points;

/**
 * Ranks the people who list in a category.
 * listings: live inventory plus closed deals. sales: closed deals (sold status or a completed reservation).
 * engagement: paid reservations, buyer conversations and favourites on their listings.
 * responsiveness: share of conversations the seller has read and answered.
 */
export async function getTopAgents(kind: Kind, limit = 4): Promise<AgentRank[]> {
  await connectDb();
  const model = kind === "property" ? Property : Car;
  const listings = await model.find({ author: { $ne: null } }).select("author status").limit(5000).lean<{ _id: unknown; author: unknown; status?: string }[]>();
  if (!listings.length) return [];

  const owner = new Map<string, string>();
  const stats = new Map<string, { total: number; closed: number; live: number; favourites: number; reservations: number; completed: number; convs: number; answered: number }>();
  const get = (id: string) => {
    let s = stats.get(id);
    if (!s) stats.set(id, (s = { total: 0, closed: 0, live: 0, favourites: 0, reservations: 0, completed: 0, convs: 0, answered: 0 }));
    return s;
  };
  for (const l of listings) {
    const a = String(l.author);
    owner.set(String(l._id), a);
    const s = get(a);
    s.total++;
    if (l.status && SOLD.includes(l.status)) s.closed++;
    else s.live++;
  }

  const [favs, reservations, convs] = await Promise.all([
    Favourite.find({ kind, listingId: { $in: [...owner.keys()] } }).select("listingId").lean<{ listingId: unknown }[]>(),
    Reservation.find({ kind, status: { $in: ["held", "confirmed", "completed"] } }).select("sellerId status").lean<{ sellerId: unknown; status: string }[]>(),
    Conversation.find({ kind }).select("sellerId sellerUnread").lean<{ sellerId: unknown; sellerUnread?: number }[]>(),
  ]);
  for (const f of favs) {
    const a = owner.get(String(f.listingId));
    if (a) get(a).favourites++;
  }
  for (const r of reservations) {
    const s = stats.get(String(r.sellerId));
    if (!s) continue;
    s.reservations++;
    if (r.status === "completed") s.completed++;
  }
  for (const c of convs) {
    const s = stats.get(String(c.sellerId));
    if (!s) continue;
    s.convs++;
    if (!c.sellerUnread) s.answered++;
  }

  const users = await User.find({ _id: { $in: [...stats.keys()] } }).select("name role verification.status").lean<{ _id: unknown; name?: string; role?: string; verification?: { status?: string } }[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return [...stats.entries()]
    .map(([id, s]) => {
      const u = byId.get(id);
      const sales = Math.max(s.closed, s.completed);
      const engagement = s.reservations + s.convs + s.favourites;
      const responsiveness = s.convs ? s.answered / s.convs : 0;
      const score = Math.round(part(s.total, WEIGHTS.listings) + part(sales, WEIGHTS.sales) + part(engagement, WEIGHTS.engagement) + responsiveness * WEIGHTS.responsiveness.points);
      return { id, name: u?.name?.trim() || "Seller", verified: u?.role === "agent" || u?.verification?.status === "verified", listings: s.live, sales, engagement, responsiveness, score, grade: grade(score) } satisfies AgentRank;
    })
    .sort((a, b) => b.score - a.score || b.sales - a.sales || b.listings - a.listings)
    .slice(0, limit);
}

export async function getAgentCount() {
  await connectDb();
  const [p, c] = await Promise.all([Property.distinct("author"), Car.distinct("author")]);
  return new Set([...p, ...c].filter(Boolean).map(String)).size;
}

export type AgentProfile = {
  id: string;
  name: string;
  verified: boolean;
  accountType: string | null;
  agency: string | null;
  bio: string | null;
  regions: string[];
  specialties: string[];
  yearsExperience: number | null;
  memberSince: string | null;
  score: number;
  grade: Grade;
  listings: number;
  sales: number;
  engagement: number;
  responsiveness: number;
  conversations: number;
  breakdown: { key: "listings" | "sales" | "engagement" | "responsiveness"; points: number; max: number }[];
  byKind: { properties: number; cars: number };
};

/** Same scoring as the rankings, across everything the seller lists. Returns null for unknown users and for users with no listings. */
export async function getAgentProfile(id: string): Promise<AgentProfile | null> {
  if (!isObjectId(id)) return null;
  await connectDb();
  const user = await User.findById(id)
    .select("name role createdAt accountType verification.status profile.agency profile.bio profile.regions profile.specialties profile.yearsExperience")
    .lean<{ name?: string; role?: string; createdAt?: Date; accountType?: string; verification?: { status?: string }; profile?: { agency?: string; bio?: string; regions?: string[]; specialties?: string[]; yearsExperience?: number } }>();
  if (!user) return null;

  const pick = { author: id };
  const [props, cars] = await Promise.all([
    Property.find(pick).select("status").limit(2000).lean<{ _id: unknown; status?: string }[]>(),
    Car.find(pick).select("status").limit(2000).lean<{ _id: unknown; status?: string }[]>(),
  ]);
  if (!props.length && !cars.length) return null;

  const closed = (l: { status?: string }) => Boolean(l.status && SOLD.includes(l.status));
  const all = [...props, ...cars];
  const live = all.filter((l) => !closed(l)).length;
  const closedCount = all.filter(closed).length;

  const [favourites, reservations, convs] = await Promise.all([
    Favourite.countDocuments({ listingId: { $in: all.map((l) => l._id) } }),
    Reservation.find({ sellerId: id, status: { $in: ["held", "confirmed", "completed"] } }).select("status").lean<{ status: string }[]>(),
    Conversation.find({ sellerId: id }).select("sellerUnread").lean<{ sellerUnread?: number }[]>(),
  ]);
  const completed = reservations.filter((r) => r.status === "completed").length;
  const answered = convs.filter((c) => !c.sellerUnread).length;

  const sales = Math.max(closedCount, completed);
  const engagement = reservations.length + convs.length + favourites;
  const responsiveness = convs.length ? answered / convs.length : 0;
  const breakdown = [
    { key: "listings" as const, points: Math.round(part(all.length, WEIGHTS.listings)), max: WEIGHTS.listings.points },
    { key: "sales" as const, points: Math.round(part(sales, WEIGHTS.sales)), max: WEIGHTS.sales.points },
    { key: "engagement" as const, points: Math.round(part(engagement, WEIGHTS.engagement)), max: WEIGHTS.engagement.points },
    { key: "responsiveness" as const, points: Math.round(responsiveness * WEIGHTS.responsiveness.points), max: WEIGHTS.responsiveness.points },
  ];
  const score = Math.round(part(all.length, WEIGHTS.listings) + part(sales, WEIGHTS.sales) + part(engagement, WEIGHTS.engagement) + responsiveness * WEIGHTS.responsiveness.points);

  return {
    id,
    name: user.name?.trim() || "Seller",
    verified: user.role === "agent" || user.verification?.status === "verified",
    accountType: user.accountType ?? null,
    agency: user.profile?.agency || null,
    bio: user.profile?.bio || null,
    regions: user.profile?.regions ?? [],
    specialties: user.profile?.specialties ?? [],
    yearsExperience: user.profile?.yearsExperience ?? null,
    memberSince: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    score,
    grade: grade(score),
    listings: live,
    sales,
    engagement,
    responsiveness,
    conversations: convs.length,
    breakdown,
    byKind: { properties: props.filter((l) => !closed(l)).length, cars: cars.filter((l) => !closed(l)).length },
  };
}
