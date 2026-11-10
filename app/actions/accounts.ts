"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { formToObject, isSellerType, profileSchema, profileToSet } from "@/lib/account-types";
import { Car, Property, User } from "@/lib/models";

export type ProfileState = { error?: string; saved?: boolean } | undefined;

// Reviews, approvals and suspensions are done in the admin portal (yousell-portal), not here.
const entry = (event: string, by: string, note = "") => ({ at: new Date(), event, by, note });

/** Onboarding for existing accounts, and later edits to the profile. Identity changes send sellers back for review. */
export async function saveProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in." };
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;

  await connectDb();
  const current = await User.findById(session.id).select("+profile.idNumber").lean<Record<string, any>>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!current) return { error: "Account not found." };
  const staff = current.role === "agent";

  if (p.accountType === "client") {
    const owned = (await Property.countDocuments({ author: session.id })) + (await Car.countDocuments({ author: session.id }));
    if (owned > 0) return { error: "You still have listings. Delete or complete them before switching to a client account." };
  }

  const changed =
    current.accountType !== p.accountType ||
    (p.accountType === "agent" && (current.profile?.agency !== p.agency || current.profile?.licenseNo !== p.licenseNo)) ||
    (isSellerType(p.accountType) && current.profile?.idNumber !== (p as { idNumber: string }).idNumber);

  const set: Record<string, unknown> = profileToSet(p);
  const update: Record<string, unknown> = { $set: set };
  const now = new Date();
  if (!isSellerType(p.accountType)) {
    set["verification.status"] = "none";
  } else if (!staff && (changed || !["verified", "pending"].includes(current.verification?.status ?? "none"))) {
    set["verification.status"] = "pending";
    set["verification.submittedAt"] = now;
    set["verification.note"] = "";
    set["termsAcceptedAt"] = now;
    update.$push = { "verification.history": entry("submitted", session.name, `${p.accountType} application${changed && current.verification?.status === "verified" ? " (details changed)" : ""}`) };
  }
  await User.updateOne({ _id: session.id }, update);
  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { saved: true };
}
