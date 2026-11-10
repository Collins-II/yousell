import { z } from "zod";
import { normalizeMsisdn } from "./momo";

export const ACCOUNT_TYPES = ["client", "landlord", "agent"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const VERIFICATION_STATUSES = ["none", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PROVINCES = ["Central", "Copperbelt", "Eastern", "Luapula", "Lusaka", "Muchinga", "Northern", "North-Western", "Southern", "Western"] as const;
export const SPECIALTIES = ["Residential sales", "Residential rentals", "Commercial property", "Land & plots", "New cars", "Used cars", "Auctions"] as const;

export const ACCOUNT_INFO: Record<AccountType, { label: string; tagline: string; points: string[]; seller: boolean }> = {
  client: {
    label: "Client",
    tagline: "I'm looking to buy or rent",
    points: ["Search, save and compare listings", "Reserve a listing with mobile money", "Message sellers after you reserve"],
    seller: false,
  },
  landlord: {
    label: "Landlord / owner",
    tagline: "I'm selling or renting out my own property or car",
    points: ["List your own property or vehicle", "Verified with your ID and ownership declaration", "Get reservations and buyer messages"],
    seller: true,
  },
  agent: {
    label: "Agent / agency",
    tagline: "I sell or let on behalf of others",
    points: ["Public agent profile with performance score", "Verified with your licence or registration", "Listings for several clients, regions and categories"],
    seller: true,
  },
};

export const isSellerType = (t?: string | null): t is "landlord" | "agent" => t === "landlord" || t === "agent";

// Zambian National Registration Card, e.g. 123456/78/1
export const NRC_PATTERN = /^\d{6}\/\d{2}\/\d$/;

const text = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const list = <T extends readonly [string, ...string[]]>(values: T, min = 0, message = "Choose at least one") =>
  z.preprocess((v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]), z.array(z.enum(values)).min(min, message));

const phone = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform((v, ctx) => {
    const n = normalizeMsisdn(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter a valid Zambian mobile number, for example 097 123 4567." });
    return n ?? "";
  });

const website = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Website must start with http:// or https://");

const accepted = z.literal("on", { error: "Please accept the terms to continue" });

export const clientProfile = z.object({
  accountType: z.literal("client"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const n = normalizeMsisdn(v);
      if (!n) ctx.addIssue({ code: "custom", message: "Enter a valid Zambian mobile number, for example 097 123 4567." });
      return n ?? undefined;
    }),
});

export const landlordProfile = z.object({
  accountType: z.literal("landlord"),
  phone,
  idNumber: z.string().trim().regex(NRC_PATTERN, "Enter your NRC number as 123456/78/1"),
  regions: list(PROVINCES, 1, "Choose the province where your property or car is"),
  ownership: z.literal("on", { error: "Confirm that you own, or are authorised to sell or let, what you list" }),
  bio: optionalText(500),
  terms: accepted,
});

export const agentProfile = z.object({
  accountType: z.literal("agent"),
  phone,
  agency: text(2, 100, "Enter your agency or trading name"),
  licenseNo: z.string().trim().min(4, "Enter your licence or registration number").max(40),
  idNumber: z.string().trim().regex(NRC_PATTERN, "Enter your NRC number as 123456/78/1"),
  yearsExperience: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).max(60).optional()),
  regions: list(PROVINCES, 1, "Choose at least one province you operate in"),
  specialties: list(SPECIALTIES, 1, "Choose at least one speciality"),
  website,
  bio: z.string().trim().min(30, "Tell buyers about yourself in at least 30 characters").max(500),
  terms: accepted,
});

export const profileSchema = z.discriminatedUnion("accountType", [clientProfile, landlordProfile, agentProfile]);
export type ProfileInput = z.infer<typeof profileSchema>;

/** FormData to a plain object, keeping repeated fields (checkbox groups) as arrays. */
export function formToObject(formData: FormData) {
  const out: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key);
    out[key] = key === "regions" || key === "specialties" ? all : all[0];
  }
  return out;
}

/** Turns `{"profile.agency": "x"}` into `{profile: {agency: "x"}}` for document creation. */
export function nest(flat: Record<string, unknown>) {
  const out: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let cur = out;
    for (const part of parts.slice(0, -1)) cur = cur[part] ??= {};
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

/** Mongo `$set` for a validated profile. Identity fields reset seller verification to pending. */
export function profileToSet(p: ProfileInput) {
  const set: Record<string, unknown> = { accountType: p.accountType, phone: p.phone ?? null };
  if (p.accountType === "client") return set;
  set["profile.idNumber"] = p.idNumber;
  set["profile.regions"] = p.regions;
  set["profile.bio"] = p.bio ?? "";
  if (p.accountType === "agent") {
    set["profile.agency"] = p.agency;
    set["profile.licenseNo"] = p.licenseNo;
    set["profile.yearsExperience"] = p.yearsExperience ?? null;
    set["profile.specialties"] = p.specialties;
    set["profile.website"] = p.website ?? "";
  }
  return set;
}

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  none: "Not submitted",
  pending: "Under review",
  verified: "Verified",
  rejected: "Needs changes",
};
