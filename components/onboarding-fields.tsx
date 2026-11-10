"use client";

import { useState } from "react";
import { Building2, Check, ShieldCheck, UserRound } from "lucide-react";
import { ACCOUNT_INFO, ACCOUNT_TYPES, PROVINCES, SPECIALTIES, isSellerType, type AccountType } from "@/lib/account-types";

export type ProfileDefaults = {
  phone?: string | null;
  agency?: string;
  licenseNo?: string;
  yearsExperience?: number | null;
  regions?: string[];
  specialties?: string[];
  website?: string;
  bio?: string;
};

const icons = { client: UserRound, landlord: Building2, agent: ShieldCheck } as const;

function Chips({ name, options, selected }: { name: string; options: readonly string[]; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className="cursor-pointer">
          <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} className="peer sr-only" />
          <span className="inline-block rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition peer-checked:border-indigo-500 peer-checked:bg-indigo-500/10 peer-checked:text-indigo-700 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/20 dark:peer-checked:text-indigo-300">{o}</span>
        </label>
      ))}
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-medium">{label}</span>
    {children}
    {hint && <span className="block text-xs text-muted">{hint}</span>}
  </label>
);

export function OnboardingFields({ initialType = "client", defaults = {}, lockedIdentity = false }: { initialType?: AccountType; defaults?: ProfileDefaults; lockedIdentity?: boolean }) {
  const [type, setType] = useState<AccountType>(initialType);
  const seller = isSellerType(type);

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-sm font-medium">I am joining as…</legend>
        <input type="hidden" name="accountType" value={type} />
        <div role="radiogroup" aria-label="Account type" className="grid gap-2.5">
          {ACCOUNT_TYPES.map((t) => {
            const info = ACCOUNT_INFO[t];
            const Icon = icons[t];
            const on = type === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(t)}
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${on ? "border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10" : "border-line bg-surface hover:border-indigo-500/40"}`}
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${on ? "bg-indigo-600 text-white" : "bg-line/60 text-muted"}`}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{info.label}</span>
                    {on && <Check className="size-4 text-indigo-600" />}
                  </span>
                  <span className="block text-xs text-muted">{info.tagline}</span>
                  {on && (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {info.points.map((p) => (
                        <li key={p} className="flex gap-1.5"><Check className="mt-0.5 size-3 shrink-0 text-emerald-500" /> {p}</li>
                      ))}
                    </ul>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label={seller ? "Mobile number" : "Mobile number (optional)"} hint="Zambian number, e.g. 097 123 4567. Never shown publicly.">
        <input name="phone" type="tel" autoComplete="tel" required={seller} defaultValue={defaults.phone ?? ""} className="field" />
      </Field>

      {seller && (
        <div className="space-y-5 rounded-xl border border-line bg-cream p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-indigo-600" /> Verification details</p>
          <p className="-mt-3 text-xs text-muted">Our team reviews these before your profile earns the verified badge. You can list while your application is under review.</p>

          {type === "agent" && (
            <>
              <Field label="Agency or trading name">
                <input name="agency" required defaultValue={defaults.agency} className="field" />
              </Field>
              <Field label="Licence or registration number" hint="Estate agent licence, motor dealer licence or PACRA registration number.">
                <input name="licenseNo" required minLength={4} maxLength={40} defaultValue={defaults.licenseNo} className="field" />
              </Field>
            </>
          )}

          <Field label="NRC number" hint="Format 123456/78/1. Used only to verify you; staff can see it, buyers can't.">
            <input name="idNumber" required inputMode="numeric" placeholder="123456/78/1" pattern="\d{6}/\d{2}/\d" autoComplete="off" className="field" />
          </Field>
          {lockedIdentity && <p className="-mt-3 text-xs text-muted">Re-enter your NRC number to confirm any change. Changing identity details sends your profile back for review.</p>}

          <div className="space-y-2">
            <span className="text-sm font-medium">{type === "agent" ? "Provinces you operate in" : "Province of your property or car"}</span>
            <Chips name="regions" options={PROVINCES} selected={defaults.regions ?? []} />
          </div>

          {type === "agent" && (
            <>
              <div className="space-y-2">
                <span className="text-sm font-medium">Specialities</span>
                <Chips name="specialties" options={SPECIALTIES} selected={defaults.specialties ?? []} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Years of experience (optional)">
                  <input name="yearsExperience" type="number" min={0} max={60} defaultValue={defaults.yearsExperience ?? ""} className="field" />
                </Field>
                <Field label="Website (optional)">
                  <input name="website" type="url" placeholder="https://" defaultValue={defaults.website} className="field" />
                </Field>
              </div>
            </>
          )}

          <Field label={type === "agent" ? "About you" : "About you (optional)"} hint="Shown on your public profile.">
            <textarea name="bio" rows={3} maxLength={500} required={type === "agent"} minLength={type === "agent" ? 30 : undefined} defaultValue={defaults.bio} className="field resize-y" />
          </Field>

          {type === "landlord" && (
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="ownership" required className="mt-1 size-4 accent-indigo-600" />
              <span>I own, or am legally authorised to sell or let, everything I list.</span>
            </label>
          )}
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="terms" required className="mt-1 size-4 accent-indigo-600" />
            <span>I confirm the details above are true and agree to YouSell&apos;s seller terms. False information leads to suspension.</span>
          </label>
        </div>
      )}
    </div>
  );
}
