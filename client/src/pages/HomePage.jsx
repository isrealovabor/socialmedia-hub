import { useMemo, useState } from "react";
import ProductCard from "../components/ProductCard.jsx";

export default function HomePage({ products, loading, error, onBuy, onFavorite }) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("newest");
  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((product) => {
        const matchesSearch =
          !term ||
          product.title?.toLowerCase().includes(term) ||
          product.category?.name?.toLowerCase().includes(term) ||
          product.platform?.toLowerCase().includes(term) ||
          String(product.price).includes(term);
        const matchesPlatform = !platform || product.platform === platform;
        return matchesSearch && matchesPlatform;
      })
      .slice()
      .sort((a, b) => {
        if (sort === "price") return a.price - b.price;
        if (sort === "popularity") return (b.orderCount || 0) - (a.orderCount || 0);
        if (sort === "stock") return (b.stock || 0) - (a.stock || 0);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [platform, products, search, sort]);

  const platforms = useMemo(
    () => [...new Set(products.map((product) => product.platform).filter(Boolean))],
    [products]
  );

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[1.6rem] bg-market-navy p-4 text-white shadow-soft">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-market-cyan/30 blur-2xl" />
        <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-market-emerald/30 blur-2xl" />
        <p className="relative text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Social media services</p>
        <h1 className="relative mt-2 text-2xl font-black leading-tight">Curated growth packages for modern creators.</h1>
        <p className="relative mt-2 text-sm leading-5 text-slate-200">
          News, service updates, and announcements are published here.
        </p>
      </section>
      <div className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Home</div>
      <section className="glass-panel rounded-[1.35rem] p-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm outline-none focus:border-market-emerald"
          placeholder="Search title, category, platform, or price"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="h-10 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-xs font-bold text-gray-700">
            <option value="">All platforms</option>
            {platforms.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-xs font-bold text-gray-700">
            <option value="newest">Newest</option>
            <option value="popularity">Popularity</option>
            <option value="stock">Stock</option>
            <option value="price">Price</option>
          </select>
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Featured category</p>
            <h2 className="text-lg font-black text-market-navy">Instagram services</h2>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-market-cyan shadow-sm">
            Live catalog
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {loading && (
            <div className="glass-panel rounded-3xl px-4 py-5 text-sm font-semibold text-slate-600 lg:col-span-2">
              Loading marketplace products...
            </div>
          )}
          {!loading && error && (
            <div className="glass-panel rounded-3xl px-4 py-4 text-sm font-semibold text-amber-800 lg:col-span-2">
              Live catalog is unavailable right now. {error}
            </div>
          )}
          {!loading && visibleProducts.length === 0 && (
            <div className="glass-panel rounded-3xl px-4 py-5 text-sm font-semibold text-slate-600 lg:col-span-2">
              {products.length === 0 ? "No services available." : "No services match your filters."}
            </div>
          )}
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} onBuy={onBuy} onFavorite={onFavorite} />
          ))}
        </div>
      </section>
    </div>
  );
}
