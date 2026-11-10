"use server";

import { redirect } from "next/navigation";
import { connectDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { User } from "@/lib/models";
import { PRO_PRICE_USD, siteUrl, stripe, stripeConfigured } from "@/lib/billing";

async function customerFor(userId: string, email: string, name: string) {
  await connectDb();
  const user = await User.findById(userId).select("stripeCustomerId").lean<{ stripeCustomerId?: string }>();
  if (user?.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({ email, name, metadata: { userId } });
  await User.updateOne({ _id: userId }, { $set: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function startCheckout() {
  const session = await getSession();
  if (!session) redirect("/login?next=/pricing");
  if (!stripeConfigured()) redirect("/pricing?error=not_configured");

  const customer = await customerFor(session.id, session.email, session.name);
  const priceId = process.env.STRIPE_PRICE_PRO;
  const checkout = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: session.id,
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: PRO_PRICE_USD * 100,
              recurring: { interval: "month" },
              product_data: { name: "YouSell Pro", description: "Unlimited listings and featured placement" },
            },
          },
    ],
    allow_promotion_codes: true,
    success_url: `${siteUrl()}/dashboard?upgraded=1`,
    cancel_url: `${siteUrl()}/pricing`,
  });
  redirect(checkout.url!);
}

export async function openPortal() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  if (!stripeConfigured()) redirect("/pricing?error=not_configured");
  await connectDb();
  const user = await User.findById(session.id).select("stripeCustomerId").lean<{ stripeCustomerId?: string }>();
  if (!user?.stripeCustomerId) redirect("/pricing");
  const portal = await stripe().billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${siteUrl()}/dashboard` });
  redirect(portal.url);
}
