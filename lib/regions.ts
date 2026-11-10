import "server-only";
import { connectDb } from "./db";
import { Car, Property } from "./models";
import { normalizeRegionName } from "./region-normalization";

export type Region = { name: string; properties: number; cars: number; total: number };
export type CountryRegions = { country: string; total: number; regions: Region[] };

// Shown even when empty so visitors see the full map of a country, not just where data happens to exist.
const CATALOGUE: Record<string, string[]> = {
  Zambia: ["Central", "Copperbelt", "Eastern", "Luapula", "Lusaka", "Muchinga", "Northern", "North-Western", "Southern", "Western"],
};

const norm = normalizeRegionName;
const key = (s: string) => norm(s).toLowerCase();

type Row = { _id: { country?: string; state?: string }; n: number };

/** Active (not sold or rented) listings grouped by country and province/state. */
export async function getRegionCounts(): Promise<CountryRegions[]> {
  await connectDb();
  const group = [{ $group: { _id: { country: "$address.country", state: "$address.state" }, n: { $sum: 1 } } }];
  const [props, cars] = await Promise.all([
    Property.aggregate<Row>([{ $match: { status: { $nin: ["SOLD", "RENTED"] } } }, ...group]),
    Car.aggregate<Row>([{ $match: { status: { $nin: ["SOLD", "PURCHASED"] } } }, ...group]),
  ]);

  const countries = new Map<string, { label: string; regions: Map<string, Region> }>();
  const bucket = (country: string, state: string) => {
    const ck = key(country);
    let c = countries.get(ck);
    if (!c) countries.set(ck, (c = { label: norm(country), regions: new Map() }));
    const rk = key(state);
    let r = c.regions.get(rk);
    if (!r) c.regions.set(rk, (r = { name: norm(state), properties: 0, cars: 0, total: 0 }));
    return r;
  };

  for (const [rows, field] of [[props, "properties"], [cars, "cars"]] as const) {
    for (const row of rows) {
      const country = row._id.country?.trim();
      const state = row._id.state?.trim();
      if (!country || !state) continue;
      const r = bucket(country, state);
      r[field] += row.n;
      r.total += row.n;
    }
  }

  for (const [country, states] of Object.entries(CATALOGUE)) {
    if (!countries.has(key(country))) countries.set(key(country), { label: country, regions: new Map() });
    for (const s of states) bucket(country, s);
  }

  return [...countries.values()]
    .map((c) => {
      const regions = [...c.regions.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
      return { country: c.label, total: regions.reduce((n, r) => n + r.total, 0), regions };
    })
    .filter((c) => c.total > 0 || CATALOGUE[c.country])
    .sort((a, b) => b.total - a.total);
}
