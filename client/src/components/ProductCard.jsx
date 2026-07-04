import { Heart, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import SocialIcon from "./SocialIcon.jsx";
import { assetUrl } from "../api/client.js";
import { formatNaira, getPlatformMeta } from "../data/marketData.js";

export default function ProductCard({ product, onBuy, onFavorite }) {
  const platform = getPlatformMeta(product);
  const categoryName =
    product.category?.name ||
    product.category?.title ||
    product.category?.slug ||
    product.category ||
    product.platform ||
    platform.name;
  const stock = typeof product.stock === "number" ? `${product.stock.toLocaleString()} pcs.` : product.stock;
  return (
    <article className="product-card mb-3 rounded-[1.35rem] border border-white/70 bg-white/88 p-3 shadow-soft backdrop-blur-sm">
      <div className="grid grid-cols-[3.25rem_1fr] gap-3">
        {product.imageUrl ? (
          <img
            src={assetUrl(product.imageUrl)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-[3.25rem] w-[3.25rem] rounded-full object-cover shadow-soft"
          />
        ) : (
          <SocialIcon category={categoryName} className="h-[3.25rem] w-[3.25rem]" />
        )}
        <div className="min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 text-sm font-black leading-snug text-market-navy">
              {product.title}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Save favourite"
                onClick={() => onFavorite?.(product)}
                className={`tap-highlight flex h-8 w-8 items-center justify-center rounded-full shadow-sm ${
                  product.isFavorite ? "bg-rose-50 text-rose-500" : "bg-white text-gray-400"
                }`}
              >
                <Heart size={16} fill={product.isFavorite ? "currentColor" : "none"} />
              </button>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-market-emerald">
                {stock}
              </span>
            </div>
          </div>
          <p className="text-xs font-medium leading-5 text-slate-600">{product.description}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white">
                from {formatNaira(product.price)}
              </span>
              <Link
                to={`/product/${product.id}`}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-market-cyan shadow-sm"
              >
                Details
              </Link>
            </div>
            <button
              type="button"
              onClick={() => onBuy(product)}
              className="tap-highlight brand-gradient flex h-10 min-w-24 items-center justify-center gap-1 rounded-full px-4 text-sm font-black text-white shadow-glow transition hover:scale-[1.02]"
            >
              <ShoppingCart size={17} />
              Buy
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
