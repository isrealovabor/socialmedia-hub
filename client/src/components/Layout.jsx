import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, LayoutDashboard, ShoppingCart, WalletCards } from "lucide-react";
import Header from "./Header.jsx";

export default function Layout({ children, cartCount, categories, unreadCount }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const location = useLocation();

  const closeCategory = () => setCategoryOpen(false);

  return (
    <div className="app-background min-h-screen">
      <div className="grid-overlay fixed inset-0 opacity-45 sm:opacity-70" />
      <div className="pointer-events-none fixed left-8 top-28 hidden h-28 w-28 rounded-full bg-cyan-300/20 blur-3xl sm:block" />
      <div className="pointer-events-none fixed bottom-24 right-8 hidden h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl sm:block" />
      <div className="relative mx-auto min-h-screen w-full max-w-[480px] lg:max-w-[1180px]">
        <Header
          categoryOpen={categoryOpen}
          onCategoryToggle={() => setCategoryOpen((open) => !open)}
          onCategoryClose={closeCategory}
          categories={categories}
          unreadCount={unreadCount}
        />
        <main onClick={closeCategory} className="px-3 pb-24 pt-3 lg:px-6">
          {children}
        </main>
        <nav className="nav-safe fixed bottom-3 left-1/2 z-30 grid h-16 w-[calc(100%-1.5rem)] max-w-[456px] -translate-x-1/2 grid-cols-4 rounded-[1.4rem] border border-white/70 bg-white/90 text-[11px] font-bold text-gray-500 shadow-soft backdrop-blur-md lg:max-w-[620px]">
          <NavItem to="/" icon={Home} label="Home" active={location.pathname === "/"} />
          <NavItem
            to="/dashboard"
            icon={LayoutDashboard}
            label="Dashboard"
            active={location.pathname === "/dashboard"}
          />
          <NavItem
            to="/wallet"
            icon={WalletCards}
            label="Wallet"
            active={location.pathname === "/wallet"}
          />
          <NavItem
            to="/cart"
            icon={ShoppingCart}
            label={`Cart${cartCount ? ` (${cartCount})` : ""}`}
            active={location.pathname === "/cart"}
          />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      className={`tap-highlight flex min-w-0 flex-col items-center justify-center gap-0.5 ${
        active ? "text-market-emerald" : "text-gray-500"
      }`}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-full transition ${active ? "bg-emerald-50" : ""}`}>
        <Icon size={20} />
      </span>
      <span className="max-w-full truncate px-1 text-center leading-tight">{label}</span>
    </Link>
  );
}
