import { ChevronDown, Grid3X3, Search, UserCircle, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CategoryDropdown from "./CategoryDropdown.jsx";
import Logo from "./Logo.jsx";

export default function Header({ categoryOpen, onCategoryToggle, onCategoryClose, categories, unreadCount = 0 }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 lg:px-6">
      <div className="glass-panel rounded-[1.35rem] px-3 py-3">
        <div className="flex h-11 items-center justify-between gap-3">
          <Logo onClick={onCategoryClose} />
          <div className="flex items-center gap-1">
            <IconButton label="Search" icon={Search} onClick={() => navigate("/")} />
            <button
              type="button"
              aria-label="Wallet"
              onClick={() => navigate("/wallet")}
              className="tap-highlight flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-market-navy shadow-sm transition hover:text-market-emerald"
            >
              <WalletCards size={20} />
            </button>
            <button
              type="button"
              aria-label="Account"
              onClick={() => navigate("/dashboard")}
              className="tap-highlight relative flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-market-navy shadow-sm transition hover:text-market-emerald"
            >
              <UserCircle size={22} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-market-emerald px-1 text-[10px] font-black text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="pt-3">
          <button
            type="button"
            aria-expanded={categoryOpen}
            aria-controls="category-menu"
            onClick={(event) => {
              event.stopPropagation();
              onCategoryToggle();
            }}
            className="tap-highlight flex h-12 w-full items-center rounded-full border border-emerald-100 bg-white/88 px-4 text-left text-sm font-bold text-market-navy shadow-sm transition hover:border-emerald-200"
          >
            <span className="brand-gradient mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
              <Grid3X3 size={17} />
            </span>
            <span className="min-w-0 flex-1 font-bold">Browse service categories</span>
            <ChevronDown
              size={20}
              className={`shrink-0 text-market-emerald transition-transform duration-200 ${categoryOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        <CategoryDropdown open={categoryOpen} onSelect={onCategoryClose} categories={categories} />
      </div>
    </header>
  );
}

function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="tap-highlight flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-market-navy shadow-sm transition hover:text-market-emerald"
    >
      <Icon size={20} />
    </button>
  );
}
