"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { saveProfile, type ProfileState } from "@/app/actions/accounts";
import type { AccountType } from "@/lib/account-types";
import { OnboardingFields, type ProfileDefaults } from "./onboarding-fields";

export function ProfileForm({ type, defaults, submitLabel }: { type: AccountType; defaults: ProfileDefaults; submitLabel: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, undefined);

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-7">
      <OnboardingFields initialType={type} defaults={defaults} lockedIdentity />
      {state?.error && <p role="alert" className="error-box">{state.error}</p>}
      {state?.saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" /> Saved
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending && <Loader2 className="size-4 animate-spin" />} {submitLabel}
      </button>
    </form>
  );
}
