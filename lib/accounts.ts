import "server-only";
import { cache } from "react";
import { connectDb } from "./db";
import { User, isObjectId } from "./models";
import { isSellerType, type AccountType, type VerificationStatus } from "./account-types";

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Account = {
  id: string;
  name: string;
  email: string;
  /** null for accounts created before onboarding existed: they must choose a type once. */
  accountType: AccountType | null;
  staff: boolean;
  suspended: boolean;
  phone: string | null;
  verification: VerificationStatus;
  verificationNote: string | null;
  submittedAt: string | null;
  profile: { agency: string; licenseNo: string; yearsExperience: number | null; regions: string[]; specialties: string[]; website: string; bio: string };
};

const iso = (d?: Date) => (d ? new Date(d).toISOString() : null);

export function toAccount(u: Doc): Account {
  const p = u.profile ?? {};
  const v = u.verification ?? {};
  const staff = u.role === "agent";
  return {
    id: String(u._id),
    name: u.name ?? "",
    email: u.email ?? "",
    accountType: u.accountType ?? null,
    staff,
    suspended: Boolean(u.suspended),
    phone: u.phone ?? null,
    // Platform staff are trusted by definition.
    verification: staff ? "verified" : (v.status as VerificationStatus) ?? "none",
    verificationNote: v.note ?? null,
    submittedAt: iso(v.submittedAt),
    profile: {
      agency: p.agency ?? "",
      licenseNo: p.licenseNo ?? "",
      yearsExperience: p.yearsExperience ?? null,
      regions: p.regions ?? [],
      specialties: p.specialties ?? [],
      website: p.website ?? "",
      bio: p.bio ?? "",
    },
  };
}

export const getAccount = cache(async (userId: string): Promise<Account | null> => {
  if (!isObjectId(userId)) return null;
  await connectDb();
  const u = await User.findById(userId).lean<Doc>();
  return u ? toAccount(u) : null;
});

/**
 * Who may publish listings. Clients may not. Landlords and agents may while their documents are
 * under review, but not once rejected or suspended. Accounts that predate onboarding keep their access.
 */
export function listingAccess(a: Account): { ok: true } | { ok: false; reason: string } {
  if (a.suspended) return { ok: false, reason: "This account has been suspended. Contact support." };
  if (a.staff) return { ok: true };
  if (a.accountType === "client") return { ok: false, reason: "Client accounts can't list. Switch to a landlord or agent account in your account settings." };
  if (a.accountType && a.verification === "rejected") return { ok: false, reason: "Your seller verification needs changes. Update your details in your account to continue listing." };
  return { ok: true };
}

export const isSeller = (a: Pick<Account, "accountType">) => isSellerType(a.accountType);

export type PublicSeller = { type: AccountType | null; verified: boolean; agency: string | null };

/** Seller trust signals for badges, keyed by user id. Never includes ID numbers or contact details. */
export async function getSellerBadges(ids: string[]): Promise<Map<string, PublicSeller>> {
  const valid = [...new Set(ids)].filter(isObjectId);
  const out = new Map<string, PublicSeller>();
  if (!valid.length) return out;
  await connectDb();
  const users = await User.find({ _id: { $in: valid } }).select("role accountType verification.status profile.agency").lean<Doc[]>();
  for (const u of users) {
    out.set(String(u._id), {
      type: u.accountType ?? null,
      verified: u.role === "agent" || u.verification?.status === "verified",
      agency: u.profile?.agency || null,
    });
  }
  return out;
}
