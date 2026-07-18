import { PackageOpen } from "lucide-react";

export default function ProductCatalogEmptyState() {
  return (
    <div className="glass-panel flex flex-col items-center rounded-3xl px-5 py-10 text-center lg:col-span-2">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-market-emerald">
        <PackageOpen size={28} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-black text-market-navy">No products available yet.</h3>
      <p className="mt-1 text-sm font-medium text-slate-600">
        Check back later or browse another category.
      </p>
    </div>
  );
}
