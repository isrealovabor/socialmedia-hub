import crypto from "node:crypto";

export function makeReferralCode(name = "SHM") {
  const prefix = name.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "SHM";
  return `${prefix}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}
