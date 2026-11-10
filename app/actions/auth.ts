"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { createSession, destroySession, findUserWithPassword } from "@/lib/auth";
import { formToObject, isSellerType, nest, profileSchema, profileToSet } from "@/lib/account-types";

export type AuthState = { error?: string } | undefined;

// Compared against when the user is unknown so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync("yousell-dummy-password", 12);
const attempts = new Map<string, { count: number; reset: number }>();

function throttled(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    attempts.set(key, { count: 1, reset: now + 15 * 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

const safeNext = (value: FormDataEntryValue | null) => {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
};

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number"),
});


export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  if (throttled(email)) return { error: "Too many attempts. Try again in a few minutes." };

  let user;
  try {
    user = await findUserWithPassword(email);
  } catch (error) {
    console.error("[auth] Unable to load account", error);
    return { error: "Sign in is temporarily unavailable. Please try again later." };
  }
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return { error: "Incorrect email or password" };
  if ((user as { suspended?: boolean }).suspended) return { error: "This account has been suspended. Contact support." };

  try {
    await createSession({ id: String(user._id), name: user.name ?? "", email: user.email });
  } catch (error) {
    console.error("[auth] Unable to create session", error);
    return { error: "Sign in is temporarily unavailable. Please try again later." };
  }
  redirect(safeNext(formData.get("next")));
}

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const raw = formToObject(formData);
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const profile = profileSchema.safeParse(raw);
  if (!profile.success) return { error: profile.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (password.toLowerCase().includes(email.split("@")[0]) && email.split("@")[0].length >= 4) return { error: "Your password shouldn't contain your email name" };

  await connectDb();
  if (await User.exists({ email })) return { error: "An account with this email already exists" };

  const now = new Date();
  const seller = isSellerType(profile.data.accountType);
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    ...nest(profileToSet(profile.data)),
    termsAcceptedAt: seller ? now : undefined,
    verification: seller
      ? { status: "pending", submittedAt: now, history: [{ at: now, event: "submitted", by: name, note: `${profile.data.accountType} application` }] }
      : { status: "none" },
  });
  await createSession({ id: String(user._id), name, email });
  redirect(seller ? "/account?welcome=1" : safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
