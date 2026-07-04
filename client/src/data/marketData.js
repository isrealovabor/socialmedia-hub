export const categories = [
  { name: "Instagram", slug: "instagram" },
  { name: "Facebook", slug: "facebook" },
  { name: "TikTok", slug: "tiktok" },
  { name: "Snapchat", slug: "snapchat" },
  { name: "X.com/Twitter", slug: "x-twitter" },
  { name: "Telegram", slug: "telegram" },
  { name: "LinkedIn", slug: "linkedin" },
  { name: "Reddit", slug: "reddit" },
  { name: "Digital Services", slug: "digital-services" },
  { name: "Marketing Packages", slug: "marketing-packages" },
  { name: "Content Templates", slug: "content-templates" },
  { name: "Proxy/VPN Services", slug: "proxy-vpn-services" },
];

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

export const products = [
  {
    id: "instagram-growth-starter",
    platform: "Instagram",
    slug: "instagram",
    icon: "IG",
    color: "bg-pink-500",
    stock: "16,887 pcs.",
    price: 2500,
    speed: "48h",
    title: "Instagram Growth Package",
    description:
      "Profile setup, content optimization, and engagement support. Delivery time 24-48h.",
    details:
      "A compact Instagram service package for creators and small brands that need profile polish, content guidance, and engagement planning support.",
  },
  {
    id: "tiktok-content-boost",
    platform: "TikTok",
    slug: "tiktok",
    icon: "TK",
    color: "bg-slate-900",
    stock: "9,420 pcs.",
    price: 3200,
    speed: "48h",
    title: "TikTok Content Boost Package",
    description:
      "Short-form content review, caption support, trend planning, and posting checklist.",
    details:
      "Designed for TikTok campaigns that need creator-friendly content ideas, structure, and practical launch support.",
  },
  {
    id: "snapchat-brand-kit",
    platform: "Snapchat",
    slug: "snapchat",
    icon: "SC",
    color: "bg-yellow-400",
    stock: "5,208 pcs.",
    price: 2100,
    speed: "48h",
    title: "Snapchat Brand Presence Kit",
    description:
      "Story content pack, profile refresh, and audience-friendly creative prompts.",
    details:
      "A lightweight Snapchat package for brands that want brighter story assets, stronger profile presentation, and content prompts.",
  },
  {
    id: "facebook-page-assist",
    platform: "Facebook",
    slug: "facebook",
    icon: "FB",
    color: "bg-blue-600",
    stock: "12,041 pcs.",
    price: 2800,
    speed: "48h",
    title: "Facebook Page Services",
    description:
      "Page setup, verified transfer assistance where allowed, content cleanup, and launch support.",
    details:
      "For teams that need compliant Facebook page support, including setup, organization, and allowed transfer assistance.",
  },
  {
    id: "x-twitter-launch",
    platform: "X/Twitter",
    slug: "x-twitter",
    icon: "X",
    color: "bg-neutral-900",
    stock: "7,663 pcs.",
    price: 2600,
    speed: "48h",
    title: "X/Twitter Launch Package",
    description:
      "Profile positioning, post templates, campaign calendar, and engagement consulting.",
    details:
      "A concise launch package for X.com/Twitter profiles, with practical messaging support and content templates.",
  },
  {
    id: "telegram-community-pack",
    platform: "Telegram",
    slug: "telegram",
    icon: "TG",
    color: "bg-sky-500",
    stock: "8,314 pcs.",
    price: 2400,
    speed: "48h",
    title: "Telegram Community Package",
    description:
      "Channel setup guidance, post templates, moderation checklist, and community launch support.",
    details:
      "Useful for Telegram channels and groups that need organized launch materials, clear posting structure, and community guidance.",
  },
];

export const recentOrders = [
  { id: "ORD-2048", item: "Instagram Growth Package", status: "Processing", total: 2500 },
  { id: "ORD-2047", item: "Telegram Community Package", status: "Delivered", total: 2400 },
  { id: "ORD-2046", item: "Facebook Page Services", status: "Review", total: 2800 },
];

export const depositHistory = [
  { id: "DEP-781", method: "Bank Transfer", amount: 10000, status: "Completed" },
  { id: "DEP-770", method: "Bitcoin", amount: 8500, status: "Completed" },
  { id: "DEP-741", method: "Bank Transfer", amount: 5000, status: "Completed" },
];

export const formatNaira = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
