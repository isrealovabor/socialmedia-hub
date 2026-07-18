export const platformColors = {
  Instagram: "bg-pink-500",
  TikTok: "bg-slate-900",
  Snapchat: "bg-yellow-400",
  Facebook: "bg-blue-600",
  "X/Twitter": "bg-neutral-900",
  Telegram: "bg-sky-500",
  "Digital Services": "bg-emerald-600",
  "Marketing Packages": "bg-indigo-600",
  "Content Templates": "bg-orange-500",
};

export const platformIcons = {
  Instagram: "IG",
  TikTok: "TK",
  Snapchat: "SC",
  Facebook: "FB",
  "X/Twitter": "X",
  Telegram: "TG",
  "Digital Services": "DS",
  "Marketing Packages": "MP",
  "Content Templates": "CT",
};

export const platformMetaBySlug = {
  instagram: { name: "Instagram", icon: "IG", color: "bg-pink-500" },
  tiktok: { name: "TikTok", icon: "TK", color: "bg-slate-900" },
  snapchat: { name: "Snapchat", icon: "SC", color: "bg-yellow-400" },
  facebook: { name: "Facebook", icon: "FB", color: "bg-blue-600" },
  "x-twitter": { name: "X/Twitter", icon: "X", color: "bg-neutral-900" },
  telegram: { name: "Telegram", icon: "TG", color: "bg-sky-500" },
  "digital-services": { name: "Digital Services", icon: "DS", color: "bg-emerald-600" },
  "marketing-packages": { name: "Marketing Packages", icon: "MP", color: "bg-indigo-600" },
  "content-templates": { name: "Content Templates", icon: "CT", color: "bg-orange-500" },
};

export function getPlatformMeta(product) {
  const slug = product?.category?.slug || product?.slug;
  if (slug && platformMetaBySlug[slug]) return platformMetaBySlug[slug];

  const normalized = String(product?.platform || "")
    .toLowerCase()
    .replace("x.com/twitter", "x/twitter")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (platformMetaBySlug[normalized]) return platformMetaBySlug[normalized];
  if (normalized === "x-twitter" || normalized === "twitter") return platformMetaBySlug["x-twitter"];

  return {
    name: product?.platform && product.platform !== "Other" ? product.platform : "Digital Services",
    icon: product?.platform?.slice(0, 2)?.toUpperCase() || "DS",
    color: "bg-emerald-600",
  };
}

export const formatNaira = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
