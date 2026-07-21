import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { walletApi } from "../api/client.js";
import { formatNaira } from "../data/marketData.js";

export default function WalletPage({ user, onUserRefresh }) {
  const [deposits, setDeposits] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [notice, setNotice] = useState("");

  const loadDeposits = async () => {
    const [walletData, depositData] = await Promise.all([
      walletApi.wallet(),
      walletApi.deposits(),
    ]);
    setWallet(walletData);
    setDeposits(depositData.deposits);
  };

  useEffect(() => {
    if (!user) return;
    loadDeposits().catch((error) => setNotice(error.message));
  }, [user]);

  if (!user) {
    return (
      <div>
        <div className="mb-3 px-1 text-xl font-black text-market-navy">Wallet</div>
        <section className="glass-panel rounded-[1.35rem] p-4">
          <p className="text-sm text-gray-600">Login to view your wallet.</p>
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
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Funds</p>
        <h1 className="text-2xl font-black text-market-navy">Wallet</h1>
      </div>
      <section className="rounded-[1.6rem] bg-market-navy p-4 text-white shadow-soft">
        <p className="text-xs font-bold uppercase text-emerald-200">Available balance</p>
        <p className="mt-1 text-3xl font-black">{formatNaira(wallet?.availableBalance ?? user.walletBalance)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-200">
          <span>Pending: {formatNaira(wallet?.pendingDeposits || 0)}</span>
          <span>Total spent: {formatNaira(wallet?.totalSpent || 0)}</span>
        </div>
      </section>
      <section>
        <div className="mb-2 px-1 text-base font-black text-market-navy">Deposit Funds</div>
        <div className="glass-panel rounded-[1.35rem] p-3">
          <p className="text-sm font-semibold text-gray-600">
            Wallet funding is handled through Paystack so successful payments are verified and credited automatically.
          </p>
        </div>
        <Link to="/deposit" className="brand-gradient mt-2 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-black text-white shadow-glow">
          Pay with Paystack
        </Link>
      </section>
      <section>
        <div className="mb-2 px-1 text-base font-black text-market-navy">Deposit History</div>
        <div className="space-y-2">
          {!deposits.length && (
            <div className="glass-panel rounded-2xl px-3 py-3 text-sm text-gray-600">
              No deposit requests yet.
            </div>
          )}
          {deposits.map((deposit) => (
            <div key={deposit.id} className="glass-panel flex items-center justify-between rounded-2xl px-3 py-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{deposit.method.replace("_", " ")}</p>
                <p className="text-xs text-gray-500">{deposit.reference || deposit.id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{formatNaira(deposit.amount)}</p>
                <p className="text-xs font-semibold text-market-emerald">{deposit.status}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
