import "server-only";
import Stripe from "stripe";
import { connectDb } from "./db";
import { Car, Property, User } from "./models";

export const FREE_LISTING_LIMIT = 3;
export const PRO_PRICE_USD = 19;

let client: Stripe | null = null;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key));
}
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type Plan = {
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  used: number;
  limit: number | null;
  hasCustomer: boolean;
};

type UserDoc = {
  stripeCustomerId?: string;
  subscription?: { status?: string; currentPeriodEnd?: Date; cancelAtPeriodEnd?: boolean };
};

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export async function countActiveListings(userId: string) {
  await connectDb();
  const [p, c] = await Promise.all([
    Property.countDocuments({ author: userId }),
    Car.countDocuments({ author: userId, status: { $nin: ["SOLD", "PURCHASED"] } }),
  ]);
  return p + c;
}

export async function getPlan(userId: string): Promise<Plan> {
  await connectDb();
  const [user, used] = await Promise.all([User.findById(userId).lean<UserDoc>(), countActiveListings(userId)]);
  const sub = user?.subscription;
  const isPro = Boolean(sub?.status && ACTIVE.has(sub.status));
  return {
    isPro,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    used,
    limit: isPro ? null : FREE_LISTING_LIMIT,
    hasCustomer: Boolean(user?.stripeCustomerId),
  };
}

export async function syncFeatured(userId: string, featured: boolean) {
  await Promise.all([
    Property.updateMany({ author: userId }, { $set: { isFeatured: featured } }),
    Car.updateMany({ author: userId }, { $set: { isFeatured: featured } }),
  ]);
}

export async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await connectDb();
  const user = await User.findOne({ stripeCustomerId: customerId }).select("_id").lean<{ _id: unknown }>();
  if (!user) return;
  const item = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const end = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const active = ACTIVE.has(sub.status);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        subscription: {
          id: sub.id,
          plan: active ? "pro" : "free",
          status: sub.status,
          currentPeriodEnd: end ? new Date(end * 1000) : undefined,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      },
    },
  );
  await syncFeatured(String(user._id), active);
}
