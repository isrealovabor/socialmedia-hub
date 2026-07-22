import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { paymentApi } from "../api/client.js";
import { formatNaira } from "../data/marketData.js";

export default function DepositPage({ user, onUserRefresh }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [paying, setPaying] = useState("");

  useEffect(() => {
    if (!user) return;
    const provider = searchParams.get("provider");
    const reference = searchParams.get("reference") || searchParams.get("tx_ref") || searchParams.get("trxref");
    if (!provider || !reference) return;

    let active = true;
    setPaying(provider);
    paymentApi
      .verify(provider, reference)
      .then(async () => {
        if (!active) return;
        await onUserRefresh();
        setMessage(`${provider} payment verified. Wallet credited.`);
        setSearchParams({});
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error.message);
      })
      .finally(() => {
        if (active) setPaying("");
      });

    return () => {
      active = false;
    };
  }, [user, searchParams, setSearchParams, onUserRefresh]);

  const providerPay = async (provider) => {
    setMessage("");
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount < 1000) {
      setMessage("Enter an amount of at least NGN 1,000.");
      return;
    }
    try {
      setPaying(provider);
      const init = await paymentApi.initialize(provider, numericAmount);
      if (init.authorizationUrl) {
        window.location.href = init.authorizationUrl;
        return;
      }
      await paymentApi.verify(provider, init.reference);
      setAmount("");
      await onUserRefresh();
      setMessage(`${provider} payment verified. Wallet credited.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPaying("");
    }
  };

  if (!user) {
    return (
      <section className="glass-panel rounded-[1.35rem] p-4">
        <p className="text-sm text-gray-600">Login to submit a deposit.</p>
        <Link to="/login" className="brand-gradient mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-black text-white shadow-glow">
          Login
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Funding</p>
        <h1 className="text-2xl font-black text-market-navy">Deposit</h1>
      </div>
      <section className="rounded-[1.6rem] bg-market-navy p-4 text-white shadow-soft">
        <p className="text-xs font-bold uppercase text-emerald-200">Current balance</p>
        <p className="mt-1 text-3xl font-black">{formatNaira(user.walletBalance)}</p>
      </section>
      {message && <div className="glass-panel rounded-2xl px-3 py-3 text-sm font-semibold text-gray-700">{message}</div>}

      <section className="glass-panel rounded-[1.35rem] p-3">
        <div className="mb-3 text-base font-black text-market-navy">Paystack deposit</div>
        <div className="rounded-2xl border border-emerald-100 bg-white/75 p-3 text-sm text-gray-700">
          Enter the amount you want to add to your wallet. Paystack verifies the payment and credits your balance automatically.
        </div>
        <div className="mt-3 space-y-2">
          <input className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm" type="number" min="1000" placeholder="Amount in naira" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-slate-600">Payment confirmation will use your verified account email: {user.email}</p>
          <button type="button" onClick={() => providerPay("paystack")} className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow">
            {paying === "paystack" ? "Checking Paystack..." : "Pay with Paystack"}
          </button>
        </div>
      </section>
    </div>
  );
}
