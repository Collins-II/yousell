import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { connectDb } from "./db";
import { User } from "./models";

const COOKIE = "yousell_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
    return new TextEncoder().encode("yousell-dev-only-secret-change-me-please");
  }
  return new TextEncoder().encode(value);
}

export type SessionUser = { id: string; name: string; email: string };

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    await connectDb();
    const account = await User.findById(payload.sub).select("suspended").lean<{ suspended?: boolean }>();
    if (account?.suspended) return null;
    return { id: payload.sub, name: String(payload.name ?? ""), email: String(payload.email ?? "") };
  } catch {
    return null;
  }
});

export async function requireSession(next = "/") {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function findUserWithPassword(email: string) {
  await connectDb();
  return User.findOne({ email }).select("+passwordHash").lean<{
    _id: unknown;
    name?: string;
    email: string;
    passwordHash?: string;
  }>();
}
