import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { catalogApi } from "../api/client.js";
import { formatNaira, getPlatformMeta } from "../data/marketData.js";

export default function ProductDetailsPage({ products, onBuy, onFavorite }) {
  const { id } = useParams();
  const [product, setProduct] = useState(products.find((item) => item.id === id));
  const [message, setMessage] = useState(product ? "" : "Loading product...");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    let active = true;
    catalogApi
      .product(id)
      .then((data) => {
        if (!active) return;
        setProduct(data.product);
        setMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!product) {
    return (
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 text-sm font-bold text-market-navy shadow-sm"
        >
          <ArrowLeft size={17} />
          Back home
        </Link>
        <div className="glass-panel mt-3 rounded-[1.35rem] p-4 text-sm text-slate-600">
          {message || "Product not found."}
        </div>
      </div>
    );
  }

  const platform = getPlatformMeta(product);
  const color = product.color || platform.color;
  const icon = product.icon || platform.icon;
  const stock = typeof product.stock === "number" ? `${product.stock.toLocaleString()} pcs.` : product.stock;
  const outOfStock = Number(product.stock) <= 0;
  const reviews = product.reviews || [];

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewMessage("");
    try {
      await catalogApi.createReview(product.id, { rating: reviewRating, comment: reviewText });
      const data = await catalogApi.product(product.id);
      setProduct(data.product);
      setReviewText("");
      setReviewMessage("Review submitted.");
    } catch (error) {
      setReviewMessage(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        <Link to="/" className="text-slate-500">
          Home
        </Link>{" "}
        / {platform.name} / Details
      </div>
      <section className="glass-panel rounded-[1.6rem] p-4">
        <div className="flex gap-3">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-black text-white shadow-soft ${color}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-market-emerald">
              {platform.name} package
            </p>
            <h1 className="mt-1 text-lg font-black leading-snug text-market-navy">{product.title}</h1>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {product.details || product.description}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-3xl border border-emerald-100 bg-white/70 p-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-gray-500">Stock</p>
            <p className="text-sm font-black text-market-navy">{stock}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase text-gray-500">Price per pc</p>
            <p className="text-sm font-black text-market-navy">from {formatNaira(product.price)}</p>
          </div>
        </div>
        <div className="mt-3 rounded-3xl border border-emerald-100 bg-white/70 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Delivery</p>
          <p className="text-sm font-black text-market-navy">{product.deliveryTime || product.speed || "48h"}</p>
        </div>
        <button
          type="button"
          onClick={() => !outOfStock && onBuy(product)}
          disabled={outOfStock}
          className="tap-highlight brand-gradient mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-black text-white shadow-glow disabled:bg-none disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none"
        >
          <ShoppingCart size={19} />
          {outOfStock ? "Sold out" : "Buy"}
        </button>
        <button
          type="button"
          onClick={() => onFavorite?.(product)}
          className="mt-2 h-11 w-full rounded-full bg-emerald-50 text-sm font-black text-market-emerald"
        >
          {product.isFavorite ? "Saved to wishlist" : "Save to wishlist"}
        </button>
      </section>

      <section className="glass-panel rounded-[1.35rem] p-3">
        <div className="mb-2 text-base font-black text-market-navy">Reviews</div>
        {reviews.length === 0 && <p className="text-sm text-gray-600">No reviews yet.</p>}
        <div className="space-y-2">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-2xl bg-white/70 px-3 py-2">
              <p className="text-xs font-black text-market-emerald">{review.rating}/5</p>
              <p className="text-sm text-gray-700">{review.comment}</p>
            </div>
          ))}
        </div>
        <form onSubmit={submitReview} className="mt-3 space-y-2">
          <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} className="h-10 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm">
            <option value={5}>5 stars</option>
            <option value={4}>4 stars</option>
            <option value={3}>3 stars</option>
            <option value={2}>2 stars</option>
            <option value={1}>1 star</option>
          </select>
          <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} className="min-h-20 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm" placeholder="Leave a review after a completed order" />
          <button type="submit" className="brand-gradient h-10 w-full rounded-full text-sm font-black text-white">
            Submit review
          </button>
          {reviewMessage && <p className="text-sm font-semibold text-gray-600">{reviewMessage}</p>}
        </form>
      </section>
    </div>
  );
}
