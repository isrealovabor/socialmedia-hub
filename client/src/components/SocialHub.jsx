import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  FaBullhorn,
  FaFacebookF,
  FaInstagram,
  FaSnapchat,
  FaTiktok,
  FaXTwitter,
} from "react-icons/fa6";
import { FaTelegramPlane } from "react-icons/fa";

const defaultItems = [
  { name: "Instagram", slug: "instagram", icon: FaInstagram },
  { name: "TikTok", slug: "tiktok", icon: FaTiktok },
  { name: "Snapchat", slug: "snapchat", icon: FaSnapchat },
  { name: "Facebook", slug: "facebook", icon: FaFacebookF },
  { name: "X/Twitter", slug: "x-twitter", icon: FaXTwitter },
  { name: "Telegram", slug: "telegram", icon: FaTelegramPlane },
  { name: "Digital Services", slug: "digital-services", icon: FaBullhorn },
  { name: "Marketing Packages", slug: "marketing-packages", icon: FaBullhorn },
];

const iconMap = defaultItems.reduce((map, item) => {
  map[item.slug] = item.icon;
  return map;
}, {});

export default function SocialHub({ categories, activeSlug = "", onSelect, className = "" }) {
  const items = normalizeItems(categories);

  return (
    <nav
      aria-label="SocialHub categories"
      className={`rounded-[1.35rem] border border-slate-200/80 bg-white/92 p-2 shadow-soft backdrop-blur-xl ${className}`}
    >
      <div className="px-3 pb-2 pt-1">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">SocialHub</p>
      </div>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon || iconMap[item.slug] || FaBullhorn;
          const active = item.slug === activeSlug;

          return (
            <li key={item.slug}>
              <Link
                to={`/category/${item.slug}`}
                onClick={onSelect}
                className={`tap-highlight group flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition duration-200 ${
                  active
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-800 hover:bg-slate-950 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition duration-200 ${
                    active
                      ? "border-white/15 bg-white/12 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-950 group-hover:border-white/15 group-hover:bg-white/12 group-hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <ChevronRight
                  size={16}
                  className={`shrink-0 transition duration-200 ${
                    active ? "text-white/70" : "text-slate-400 group-hover:translate-x-0.5 group-hover:text-white/70"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function normalizeItems(categories) {
  const allowed = new Set(defaultItems.map((item) => item.slug));
  const provided = (categories || [])
    .filter((category) => allowed.has(category.slug))
    .map((category) => ({
      name: category.name,
      slug: category.slug,
      icon: iconMap[category.slug],
    }));

  return provided.length ? provided : defaultItems;
}
