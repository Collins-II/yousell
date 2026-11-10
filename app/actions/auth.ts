"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { createSession, destroySession, findUserWithPassword } from "@/lib/auth";

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
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  if (throttled(email)) return { error: "Too many attempts. Try again in a few minutes." };

  const user = await findUserWithPassword(email);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return { error: "Incorrect email or password" };

  await createSession({ id: String(user._id), name: user.name ?? "", email: user.email });
  redirect(safeNext(formData.get("next")));
}

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  await connectDb();
  if (await User.exists({ email })) return { error: "An account with this email already exists" };

  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  await createSession({ id: String(user._id), name, email });
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
