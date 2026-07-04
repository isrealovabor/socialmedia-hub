import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { orderApi } from "../api/client.js";
import { formatNaira, getPlatformMeta } from "../data/marketData.js";

export default function CartPage({
  cart,
  user,
  onQuantityChange,
  onRemove,
  onClearCart,
  onUserRefresh,
  onCatalogRefresh,
}) {
  const [message, setMessage] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const payable = total;
  const balance = user?.walletBalance ?? 0;
  const insufficient = cart.length > 0 && payable > balance;

  const checkout = async () => {
    setMessage("");
    if (!user) {
      setMessage("Login to checkout.");
      return;
    }
    try {
      setCheckingOut(true);
      await orderApi.checkout(
        cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        }))
      );
      setMessage("Checkout completed.");
      onClearCart();
      await onUserRefresh();
      await onCatalogRefresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Checkout</p>
        <h1 className="text-2xl font-black text-market-navy">Cart</h1>
      </div>
      {cart.length === 0 ? (
        <section className="glass-panel rounded-[1.35rem] p-4 text-center">
          <p className="text-sm text-gray-600">Your cart is empty.</p>
          <Link
            to="/"
            className="brand-gradient mt-3 inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-black text-white shadow-glow"
          >
            Browse packages
          </Link>
        </section>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onQuantityChange={onQuantityChange}
                onRemove={onRemove}
              />
            ))}
          </div>
          <section className="glass-panel rounded-[1.35rem] p-3">
            <div className="flex items-center justify-between text-sm font-bold text-gray-700">
              <span>Wallet balance</span>
              <span>{formatNaira(balance)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-lg font-black text-gray-900">
              <span>Total</span>
              <span>{formatNaira(payable)}</span>
            </div>
            {insufficient && (
              <p className="mt-3 rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-800">
                Insufficient balance. Please deposit funds.
              </p>
            )}
            {message && (
              <p className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
                {message}
              </p>
            )}
            <button
              type="button"
              onClick={checkout}
              disabled={insufficient || checkingOut}
              className="tap-highlight brand-gradient mt-3 h-11 w-full rounded-full text-sm font-black text-white shadow-glow disabled:bg-none disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none"
            >
              {checkingOut ? "Processing..." : "Checkout"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function CartItem({ item, onQuantityChange, onRemove }) {
  const platform = getPlatformMeta(item);
  return (
    <article className="glass-panel rounded-[1.35rem] p-3">
                <div className="flex gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${item.color || platform.color}`}
                  >
                    {item.icon || platform.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug text-gray-900">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-700">{formatNaira(item.price)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => onRemove(item.id)}
                    className="tap-highlight flex h-9 w-9 items-center justify-center rounded text-gray-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex h-9 items-center overflow-hidden rounded-full border border-emerald-100 bg-white">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                      className="tap-highlight flex h-9 w-10 items-center justify-center bg-emerald-50"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="flex h-9 w-12 items-center justify-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                      className="tap-highlight flex h-9 w-10 items-center justify-center bg-emerald-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <p className="text-sm font-black text-gray-900">
                    {formatNaira(item.price * item.quantity)}
                  </p>
                </div>
              </article>
  );
}
