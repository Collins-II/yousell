import Link from "next/link";

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="zv-g" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1769c2" />
        </linearGradient>
      </defs>
      {/* hexagon with a Y: two paths meeting in one deal */}
      <path d="M24 2.5l18.5 10.75v21.5L24 45.5 5.5 34.75v-21.5L24 2.5z" fill="#1d2b41" stroke="url(#zv-g)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 15.5l10 12.5 10-12.5" stroke="url(#zv-g)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 28v10" stroke="url(#zv-g)" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="24" cy="14" r="1.8" fill="#fff" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-baseline ${className}`} aria-label="YouSell home">
      <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-[#1d2b41] dark:text-white">You</span>
      <span className="bg-gradient-to-br from-[#60a5fa] via-[#3b82f6] to-[#1769c2] bg-clip-text font-display text-[26px] font-extrabold italic leading-none tracking-[-0.04em] text-transparent">Sell</span>
      <span className="ml-0.5 size-2 self-end rounded-full bg-[#1769c2] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-125 dark:bg-[#60a5fa]" aria-hidden />
    </Link>
  );
}
