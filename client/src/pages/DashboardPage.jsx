import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, PackageCheck, ShoppingCart, WalletCards } from "lucide-react";
import { notificationApi, orderApi } from "../api/client.js";
import { formatNaira } from "../data/marketData.js";

export default function DashboardPage({ user, cartCount, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([orderApi.myOrders(), notificationApi.list()])
      .then(([orderData, notificationData]) => {
        setOrders(orderData.orders);
        setNotifications(notificationData.notifications || []);
      })
      .catch((error) => setMessage(error.message));
  }, [user]);

  const markNotificationsRead = async () => {
    await notificationApi.markAllRead();
    const data = await notificationApi.list();
    setNotifications(data.notifications || []);
  };

  const downloadOrder = async (order, itemId, fileId) => {
    try {
      const data = await orderApi.downloadLink(order.id, itemId, fileId);
      window.open(orderApi.withAccessToken(data.url), "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!user) {
    return (
      <div>
        <div className="mb-3 px-1 text-xl font-black text-market-navy">Dashboard</div>
        <section className="glass-panel rounded-[1.35rem] p-4">
          <p className="text-sm text-gray-600">Login to view your wallet and orders.</p>
          <Link className="brand-gradient mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-black text-white shadow-glow" to="/login">
            Login
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Account</p>
        <h1 className="text-2xl font-black text-market-navy">Dashboard</h1>
      </div>
      <section className="relative overflow-hidden rounded-[1.6rem] bg-market-navy p-4 text-white shadow-soft">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-market-cyan/30 blur-2xl" />
        <p className="relative text-xs font-bold uppercase text-emerald-200">Wallet balance</p>
        <p className="relative mt-1 text-3xl font-black">{formatNaira(user.walletBalance)}</p>
        <p className="relative mt-1 text-sm font-semibold text-slate-200">{user.name}</p>
        {user.referralCode && (
          <div className="relative mt-3 rounded-2xl bg-white/10 p-3 text-xs font-bold text-slate-100">
            <p>Referral code: {user.referralCode}</p>
            <p>Referral earnings: {formatNaira(user.referralEarnings || 0)}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/register?ref=${user.referralCode}`)}
              className="mt-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black"
            >
              Copy referral link
            </button>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <QuickButton to="/wallet" icon={WalletCards} label="Deposit" />
          <QuickButton to="/dashboard" icon={PackageCheck} label="Orders" />
          <QuickButton to="/cart" icon={ShoppingCart} label={`Cart ${cartCount ? cartCount : ""}`} />
          {user.role === "ADMIN" && <QuickButton to="/admin" icon={PackageCheck} label="Admin" />}
          <button
            type="button"
            onClick={onLogout}
            className="tap-highlight flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 text-sm font-bold text-white backdrop-blur"
          >
            <LogOut size={18} className="text-emerald-200" />
            Logout
          </button>
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-base font-black text-market-navy">Notifications</div>
          {notifications.some((item) => !item.isRead) && (
            <button type="button" onClick={markNotificationsRead} className="text-xs font-black text-market-emerald">
              Mark read
            </button>
          )}
        </div>
        <div className="mb-4 space-y-2">
          {notifications.slice(0, 4).map((item) => (
            <div key={item.id} className="glass-panel rounded-2xl px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                {!item.isRead && <span className="h-2 w-2 rounded-full bg-market-emerald" />}
              </div>
              <p className="mt-1 text-xs text-gray-600">{item.message}</p>
            </div>
          ))}
        </div>
        <div className="mb-2 px-1 text-base font-black text-market-navy">Recent Orders</div>
        <div className="space-y-2">
          {message && <div className="glass-panel rounded-2xl px-3 py-3 text-sm text-red-600">{message}</div>}
          {!orders.length && !message && (
            <div className="glass-panel rounded-2xl px-3 py-3 text-sm text-gray-600">
              No recent orders yet.
            </div>
          )}
          {orders.map((order) => (
            <div key={order.id} className="glass-panel rounded-2xl px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    {order.item || order.items?.map((item) => item.product.title).join(", ")}
                  </p>
                  <p className="text-xs text-gray-500">{order.orderNumber || order.id}</p>
                  <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-market-emerald">
                  {order.status}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-700">
                {formatNaira(order.total ?? order.totalAmount)}
              </p>
              {order.status === "COMPLETED" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {order.deliveryFileUrl && (
                    <button
                      type="button"
                      onClick={() => downloadOrder(order)}
                      className="inline-flex h-9 items-center rounded-full bg-emerald-50 px-3 text-xs font-black text-market-emerald"
                    >
                      Download Now
                    </button>
                  )}
                  {order.items
                    ?.filter((item) => item.product?.deliveryType === "INSTANT_DOWNLOAD")
                    .flatMap((item) =>
                      (item.product.deliveryFiles || []).map((file) => (
                        <button
                          key={`${item.id}-${file.id}`}
                          type="button"
                          onClick={() => downloadOrder(order, item.id, file.id)}
                          className="inline-flex h-9 items-center rounded-full bg-cyan-50 px-3 text-xs font-black text-market-cyan"
                        >
                          Download {file.fileName}
                        </button>
                      ))
                    )}
                  {order.items
                    ?.filter((item) => item.product?.deliveryType === "MANUAL_SERVICE" || item.product?.deliveryType === "SERVICE")
                    .map((item) => (
                      <p key={item.id} className="w-full rounded-2xl bg-white/70 px-3 py-2 text-xs text-gray-600">
                        {item.product.deliveryInstructions || "Manual service: our team will follow up with onboarding details."}
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickButton({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="tap-highlight flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
    >
      <Icon size={18} className="text-emerald-200" />
      {label}
    </Link>
  );
}
