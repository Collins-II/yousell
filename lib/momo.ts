// Pure helpers shared by the server and the payment dialog. Nothing in here touches secrets.

export const NETWORKS = {
  mtn: { label: "MTN MoMo", short: "MTN", prefixes: ["96", "76"], color: "#ffcc00", ink: "#1b1b1b" },
  airtel: { label: "Airtel Money", short: "Airtel", prefixes: ["97", "77"], color: "#e40000", ink: "#ffffff" },
  zamtel: { label: "Zamtel Kwacha", short: "Zamtel", prefixes: ["95", "75"], color: "#00a651", ink: "#ffffff" },
} as const;

export type Network = keyof typeof NETWORKS;
export const NETWORK_KEYS = Object.keys(NETWORKS) as Network[];

/** Normalises 097…, +26097…, 26097… or 97… into 260XXXXXXXXX. Returns null when it isn't a Zambian mobile number. */
export function normalizeMsisdn(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  let national: string;
  if (/^260\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{9}$/.test(digits)) national = digits;
  else return null;
  return /^[79]\d{8}$/.test(national) ? `260${national}` : null;
}

export function detectNetwork(msisdn: string): Network | null {
  const prefix = msisdn.slice(3, 5);
  return NETWORK_KEYS.find((n) => (NETWORKS[n].prefixes as readonly string[]).includes(prefix)) ?? null;
}

export const maskMsisdn = (msisdn: string) => `+260 ${msisdn.slice(3, 5)}• ••• •${msisdn.slice(-2)}`;

export const formatKwacha = (amount: number) => `K${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
