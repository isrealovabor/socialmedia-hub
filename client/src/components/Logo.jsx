import { Link } from "react-router-dom";

export default function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="tap-highlight flex min-w-0 items-center gap-2">
      <span className="brand-gradient relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-glow">
        <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-white" />
        <span className="absolute right-2.5 top-3 h-2 w-2 rounded-full bg-white/90" />
        <span className="absolute bottom-2.5 left-3 h-2 w-2 rounded-full bg-white/85" />
        <span className="absolute h-0.5 w-5 -rotate-12 rounded bg-white/70" />
        <span className="absolute h-0.5 w-4 rotate-45 rounded bg-white/60" />
      </span>
      <span className="min-w-0 leading-none">
        <span className="block truncate text-base font-black tracking-tight text-market-navy">
          SocialHub
        </span>
        <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-market-emerald">
          Market
        </span>
      </span>
    </Link>
  );
}
