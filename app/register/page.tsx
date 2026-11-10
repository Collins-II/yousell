import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  if (await getSession()) redirect("/");
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted">Join YouSell to list and save properties and cars.</p>
      </div>
      <AuthForm mode="register" next={next} />
    </div>
  );
}
