import { useMemo, useState } from "react";
import { ChevronRight, Gamepad2, Mail, PackageCheck, ShieldCheck, Sparkles, Users } from "lucide-react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaRedditAlien,
  FaTiktok,
  FaXTwitter,
} from "react-icons/fa6";
import { FaTelegramPlane } from "react-icons/fa";

const platforms = [
  { name: "Instagram", slug: "instagram", icon: FaInstagram },
  { name: "FB", slug: "facebook", icon: FaFacebookF },
  { name: "Gmail", slug: "gmail", icon: Mail },
  { name: "X.com", slug: "x-twitter", icon: FaXTwitter },
  { name: "TikTok", slug: "tiktok", icon: FaTiktok },
  { name: "LinkedIn", slug: "linkedin", icon: FaLinkedinIn },
  { name: "Telegram", slug: "telegram", icon: FaTelegramPlane },
  { name: "Reddit", slug: "reddit", icon: FaRedditAlien },
  { name: "Other Email Services", slug: "other-email-services", icon: Mail },
  { name: "Game Accounts", slug: "game-accounts", icon: Gamepad2 },
];

const subCategories = [
  { name: "Softreg", slug: "softreg", icon: Sparkles },
  { name: "Aged", slug: "aged", icon: ShieldCheck },
  { name: "With Followers", slug: "with-followers", icon: Users },
];

const serviceTypes = [
  { name: "Content Packs", slug: "content-packs" },
  { name: "Setup Documents", slug: "setup-documents" },
  { name: "Strategy Guides", slug: "strategy-guides" },
  { name: "Onboarding Forms", slug: "onboarding-forms" },
];

export default function MultiLevelNavMenu({ onSelect, className = "" }) {
  const [platform, setPlatform] = useState(platforms[0]);
  const [category, setCategory] = useState(subCategories[0]);

  const selectedPath = useMemo(
    () => ({
      platform: platform.slug,
      category: category.slug,
    }),
    [platform, category]
  );

  const handleFinalSelect = (service) => {
    onSelect?.({ ...selectedPath, service: service.slug });
  };

  return (
    <section className={`rounded-[1.4rem] border border-slate-200 bg-white/95 p-2 shadow-soft backdrop-blur-xl ${className}`}>
      <div className="grid gap-2 md:grid-cols-[1.15fr_0.9fr_1fr]">
        <MenuColumn title="SocialHub">
          {platforms.map((item) => (
            <MenuButton key={item.slug} item={item} active={platform.slug === item.slug} onClick={() => setPlatform(item)} />
          ))}
        </MenuColumn>

        <MenuColumn title={platform.name}>
          {subCategories.map((item) => (
            <MenuButton key={item.slug} item={item} active={category.slug === item.slug} onClick={() => setCategory(item)} />
          ))}
        </MenuColumn>

        <MenuColumn title={category.name}>
          {serviceTypes.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => handleFinalSelect(item)}
              className="group flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold text-slate-800 transition hover:bg-slate-950 hover:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-950 transition group-hover:border-white/15 group-hover:bg-white/12 group-hover:text-white">
                <PackageCheck size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <ChevronRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
            </button>
          ))}
        </MenuColumn>
      </div>
    </section>
  );
}

function MenuColumn({ title, children }) {
  return (
    <div className="rounded-[1.15rem] bg-slate-50/80 p-2">
      <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function MenuButton({ item, active, onClick }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold transition ${
        active ? "bg-slate-950 text-white shadow-sm" : "text-slate-800 hover:bg-slate-950 hover:text-white"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
          active
            ? "border-white/15 bg-white/12 text-white"
            : "border-slate-200 bg-white text-slate-950 group-hover:border-white/15 group-hover:bg-white/12 group-hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      <ChevronRight size={16} className={active ? "text-white/70" : "text-slate-400 group-hover:text-white/70"} />
    </button>
  );
}
