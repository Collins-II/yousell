"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login, register, type AuthState } from "@/app/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, undefined);
  const isLogin = mode === "login";

  return (
    <form action={action} className="card space-y-4 p-6 sm:p-8">
      <input type="hidden" name="next" value={next} />
      {!isLogin && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Full name</span>
          <input name="name" autoComplete="name" required className="field" />
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" autoComplete="email" required className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={isLogin ? undefined : 8} required className="field" />
        {!isLogin && <span className="text-xs text-muted">At least 8 characters</span>}
      </label>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {isLogin ? "Sign in" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        {isLogin ? "New to YouSell? " : "Already have an account? "}
        <Link href={`${isLogin ? "/register" : "/login"}?next=${encodeURIComponent(next)}`} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
