import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { favoriteApi } from "../api/client.js";

export default function WishlistPage({ user, onBuy, onFavorite }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("Loading wishlist...");

  const load = async () => {
    const data = await favoriteApi.list();
    setItems(data.favorites.map((favorite) => favorite.product));
    setMessage(data.favorites.length ? "" : "No favourite products yet.");
  };

  useEffect(() => {
    if (!user) return;
    load().catch((error) => setMessage(error.message));
  }, [user]);

  if (!user) {
    return (
      <section className="glass-panel rounded-[1.35rem] p-4">
        <p className="text-sm text-gray-600">Login to view your wishlist.</p>
        <Link to="/login" className="brand-gradient mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-black text-white shadow-glow">Login</Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Saved</p>
        <h1 className="text-2xl font-black text-market-navy">Wishlist</h1>
      </div>
      {message && <div className="glass-panel rounded-[1.35rem] p-4 text-sm font-semibold text-slate-600">{message}</div>}
      {items.map((product) => (
        <ProductCard key={product.id} product={{ ...product, isFavorite: true }} onBuy={onBuy} onFavorite={onFavorite} />
      ))}
    </div>
  );
}
