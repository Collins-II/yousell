import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { ACCOUNT_TYPES } from "@/lib/account-types";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; type?: string }> }) {
  const { next = "/", type } = await searchParams;
  if (await getSession()) redirect("/");
  const initial = ACCOUNT_TYPES.find((t) => t === type) ?? "client";
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted">Choose how you&apos;ll use YouSell: buying, owning, or selling for clients.</p>
      </div>
      <AuthForm mode="register" next={next} type={initial} />
    </div>
  );
}
