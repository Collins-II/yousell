"use client";

import { useActionState, useState } from "react";
import { Car, Gavel, Home, Loader2, Tag } from "lucide-react";
import { createListing, updateListing, type ListingState } from "@/app/actions/listings";
import type { EditableListing } from "@/lib/listings";
import { ImageUploader } from "./image-uploader";
import { LocationPicker } from "./location-picker";

function Field({ label, children, className = "", hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function ListingForm({ edit }: { edit?: EditableListing }) {
  const [kind, setKind] = useState<"property" | "car">(edit?.kind ?? "property");
  const [category, setCategory] = useState(String(edit?.values.category ?? "Sale"));
  const [saleMode, setSaleMode] = useState<"fixed" | "auction">("fixed");
  const [state, action, pending] = useActionState<ListingState, FormData>(edit ? updateListing : createListing, undefined);
  const v = edit?.values ?? {};
  const hasAuction = Boolean(edit?.auction);
  const biddingStarted = Boolean(edit?.auction && edit.auction.status === "live" && edit.auction.bidCount > 0);
  const year = new Date().getFullYear();
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  const initialPos = v.lat !== undefined && v.lat !== "" && v.lng !== "" && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="kind" value={kind} />
      {edit && <input type="hidden" name="id" value={edit.id} />}
      {category === "Sale" && !edit && <input type="hidden" name="saleMode" value={saleMode} />}
      {!edit && (
        <div className="grid grid-cols-2 gap-3" role="tablist" aria-label="Listing type">
          {([["property", "Property", Home], ["car", "Car", Car]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`card flex items-center justify-center gap-2 p-4 font-semibold transition ${kind === k ? "!border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "text-muted hover:text-fg"}`}>
              <Icon className="size-5" /> {label}
            </button>
          ))}
        </div>
      )}

      <Section title="Overview" hint="A clear title and description help buyers find you.">
        <Field label="Title" className="sm:col-span-2">
          <input name="title" required minLength={5} maxLength={120} defaultValue={v.title} placeholder={kind === "property" ? "Modern 3-bed house in Kabulonga" : "2018 Toyota Fortuner 2.8 GD-6"} className="field" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea name="description" required minLength={20} maxLength={5000} rows={6} defaultValue={v.description} className="field resize-y" />
        </Field>
      </Section>

      <Section title="Pricing" hint="Sell at a fixed price, or let buyers compete in an auction.">
        <Field label="Listing">
          <select name="category" className="field" value={category} onChange={(e) => setCategory(e.target.value)} disabled={biddingStarted}>
            <option value="Sale">For sale</option>
            <option value="Rent">For rent</option>
          </select>
          {biddingStarted && <input type="hidden" name="category" value={category} />}
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={saleMode === "auction" || hasAuction ? "Starting bid" : "Price"}>
            <input name="price" type="number" min={1} step="any" required defaultValue={v.price} readOnly={biddingStarted} className="field" />
          </Field>
          <Field label="Currency">
            <select name="currency" className="field" defaultValue={String(v.currency ?? "USD")} disabled={biddingStarted}>
              {["USD", "EUR", "GBP", "ZMW"].map((c) => <option key={c}>{c}</option>)}
            </select>
            {biddingStarted && <input type="hidden" name="currency" value={String(v.currency)} />}
          </Field>
        </div>

        {!edit && category === "Sale" && (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2" role="radiogroup" aria-label="Sale type">
            {([["fixed", "Fixed price", "Buyers contact you to agree a deal", Tag], ["auction", "Auction", "Buyers bid; highest bid wins", Gavel]] as const).map(([m, label, hint, Icon]) => (
              <button key={m} type="button" role="radio" aria-checked={saleMode === m} onClick={() => setSaleMode(m)} className={`rounded-xl border p-4 text-left transition ${saleMode === m ? "border-indigo-500 bg-indigo-500/10" : "border-line hover:border-indigo-500/40"}`}>
                <span className="flex items-center gap-2 font-semibold"><Icon className="size-4" /> {label}</span>
                <span className="mt-1 block text-xs text-muted">{hint}</span>
              </button>
            ))}
          </div>
        )}
        {!edit && category === "Sale" && saleMode === "auction" && (
          <>
            <Field label="Duration" hint="Bids in the last 2 minutes extend the end time.">
              <select name="auctionDays" className="field" defaultValue="7">
                {[1, 3, 5, 7, 10, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
              </select>
            </Field>
            <Field label="Reserve price (optional)" hint="Hidden minimum — the item only sells if bids reach it.">
              <input name="reserve" type="number" min={0} step="any" className="field" />
            </Field>
          </>
        )}
        {hasAuction && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 sm:col-span-2 dark:text-amber-300">
            {biddingStarted ? "Bidding has started, so price, currency and sale type are locked." : "This is an auction. Changing the starting bid updates the auction."}
          </p>
        )}
      </Section>

      <Section title={kind === "property" ? "Property details" : "Vehicle details"}>
        {kind === "property" ? (
          <>
            <Field label="Bedrooms"><input name="bedrooms" type="number" min={0} max={50} defaultValue={v.bedrooms ?? 2} required className="field" /></Field>
            <Field label="Bathrooms"><input name="bathrooms" type="number" min={0} max={50} defaultValue={v.bathrooms ?? 1} required className="field" /></Field>
            <Field label="Size (m²)"><input name="size" type="number" min={0} defaultValue={v.size} className="field" /></Field>
          </>
        ) : (
          <>
            <Field label="Make"><input name="make" required defaultValue={v.make} placeholder="Toyota" className="field" /></Field>
            <Field label="Model"><input name="carModel" required defaultValue={v.carModel} placeholder="Fortuner" className="field" /></Field>
            <Field label="Year"><input name="year" type="number" min={1950} max={year + 1} defaultValue={v.year ?? year - 3} required className="field" /></Field>
            <Field label="Mileage (km)"><input name="mileage" type="number" min={0} defaultValue={v.mileage ?? 0} required className="field" /></Field>
            <Field label="Fuel">
              <select name="fuel" className="field" defaultValue={String(v.fuel ?? "PETROL")}>
                {["PETROL", "DIESEL", "ELECTRIC", "HYBRID"].map((f) => <option key={f} value={f}>{f[0] + f.slice(1).toLowerCase()}</option>)}
              </select>
            </Field>
            <Field label="Gearbox">
              <select name="transmission" className="field" defaultValue={String(v.transmission ?? "AUTOMATIC")}>
                <option value="AUTOMATIC">Automatic</option>
                <option value="MANUAL">Manual</option>
              </select>
            </Field>
          </>
        )}
      </Section>

      <Section title="Location" hint="Drop a pin so your listing shows up on the map.">
        <Field label="Country"><input name="country" required defaultValue={v.country ?? "Zambia"} className="field" /></Field>
        <Field label="State / province"><input name="state" required defaultValue={v.state} className="field" /></Field>
        <Field label="Area / suburb" className="sm:col-span-2"><input name="suburb" defaultValue={v.suburb} className="field" /></Field>
        <div className="sm:col-span-2"><LocationPicker initial={initialPos} /></div>
      </Section>

      <Section title="Photos" hint="Great photos sell faster.">
        <div className="sm:col-span-2"><ImageUploader initial={edit?.images} /></div>
      </Section>

      {state?.error && <p role="alert" className="error-box">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={pending} className="btn-primary">
          {pending && <Loader2 className="size-4 animate-spin" />} {edit ? "Save changes" : saleMode === "auction" && category === "Sale" ? "Start auction" : "Publish listing"}
        </button>
      </div>
    </form>
  );
}
