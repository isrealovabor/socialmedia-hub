import {
  FaBullhorn,
  FaFacebookF,
  FaFileLines,
  FaInstagram,
  FaLinkedinIn,
  FaRedditAlien,
  FaSnapchat,
  FaTiktok,
  FaXTwitter,
} from "react-icons/fa6";
import { FaTelegramPlane } from "react-icons/fa";

const iconMap = {
  instagram: FaInstagram,
  facebook: FaFacebookF,
  tiktok: FaTiktok,
  snapchat: FaSnapchat,
  twitter: FaXTwitter,
  x: FaXTwitter,
  "x-twitter": FaXTwitter,
  "xcom-twitter": FaXTwitter,
  telegram: FaTelegramPlane,
  linkedin: FaLinkedinIn,
  reddit: FaRedditAlien,
  "digital-services": FaBullhorn,
  "marketing-packages": FaBullhorn,
  "content-templates": FaFileLines,
};

const colorMap = {
  instagram: "bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 text-white",
  facebook: "bg-blue-600 text-white",
  tiktok: "bg-slate-950 text-white",
  snapchat: "bg-yellow-300 text-slate-950",
  twitter: "bg-slate-950 text-white",
  x: "bg-slate-950 text-white",
  "x-twitter": "bg-slate-950 text-white",
  "xcom-twitter": "bg-slate-950 text-white",
  telegram: "bg-sky-500 text-white",
  linkedin: "bg-blue-700 text-white",
  reddit: "bg-orange-500 text-white",
  "digital-services": "bg-emerald-600 text-white",
  "marketing-packages": "bg-indigo-600 text-white",
  "content-templates": "bg-amber-500 text-white",
};

export function normalizeCategory(value) {
  return String(value || "")
    .toLowerCase()
    .replace("x.com/twitter", "x-twitter")
    .replace("x/twitter", "x-twitter")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getSocialIconMeta(category) {
  const key = normalizeCategory(category);
  return {
    Icon: iconMap[key] || FaBullhorn,
    className: colorMap[key] || "bg-emerald-600 text-white",
  };
}

export default function SocialIcon({ category, className = "", iconClassName = "h-5 w-5" }) {
  const { Icon, className: colorClass } = getSocialIconMeta(category);

  return (
    <div className={`flex items-center justify-center rounded-full shadow-soft ${colorClass} ${className}`}>
      <Icon className={iconClassName} aria-hidden="true" />
    </div>
  );
}
