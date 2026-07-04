import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { paymentApi, walletApi } from "../api/client.js";
import { formatNaira } from "../data/marketData.js";

export default function DepositPage({ user, onUserRefresh }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [options, setOptions] = useState(null);
  const [amount, setAmount] = useState("");
  const [paymentEmail, setPaymentEmail] = useState(user?.email || "");
  const [btcAmount, setBtcAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [message, setMessage] = useState("");
  const [paying, setPaying] = useState("");

  useEffect(() => {
    walletApi.depositOptions().then(setOptions).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (user?.email && !paymentEmail) setPaymentEmail(user.email);
  }, [user?.email, paymentEmail]);

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

  const submitBitcoin = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      await walletApi.createBitcoinDeposit({ amount: Number(btcAmount), transactionHash: txHash });
      setBtcAmount("");
      setTxHash("");
      await onUserRefresh();
      setMessage("Bitcoin deposit submitted for admin approval.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const providerPay = async (provider) => {
    setMessage("");
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount < 1000) {
      setMessage("Enter an amount of at least NGN 1,000.");
      return;
    }
    const cleanPaymentEmail = paymentEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanPaymentEmail) || cleanPaymentEmail.endsWith(".test")) {
      setMessage("Enter a real Paystack email address. Do not use admin@socialhub.test.");
      return;
    }
    try {
      setPaying(provider);
      const init = await paymentApi.initialize(provider, numericAmount, cleanPaymentEmail);
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

  const bitcoin = options?.bitcoinDetails;

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
          <input className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm" type="email" placeholder="Paystack email address" value={paymentEmail} onChange={(event) => setPaymentEmail(event.target.value)} required />
          <button type="button" onClick={() => providerPay("paystack")} className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow">
            {paying === "paystack" ? "Checking Paystack..." : "Pay with Paystack"}
          </button>
        </div>
      </section>

      <section className="glass-panel rounded-[1.35rem] p-3">
        <div className="mb-3 text-base font-black text-market-navy">Bitcoin deposit</div>
        <div className="rounded-2xl border border-cyan-100 bg-white/75 p-3 text-center">
          {bitcoin?.qrCode && <img className="mx-auto h-32 w-32 rounded-xl" src={bitcoin.qrCode} alt="BTC QR code" />}
          <p className="mt-2 break-all text-xs font-bold text-gray-700">{bitcoin?.address}</p>
          <button type="button" onClick={() => navigator.clipboard?.writeText(bitcoin?.address || "")} className="mt-2 inline-flex h-9 items-center gap-2 rounded-full bg-emerald-50 px-3 text-xs font-black text-market-emerald">
            <Copy size={15} />
            Copy
          </button>
        </div>
        <form onSubmit={submitBitcoin} className="mt-3 space-y-2">
          <input className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm" type="number" step="0.00000001" min="0" placeholder="BTC amount" value={btcAmount} onChange={(event) => setBtcAmount(event.target.value)} required />
          <input className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm" placeholder="Transaction hash" value={txHash} onChange={(event) => setTxHash(event.target.value)} required />
          <button className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow" type="submit">
            Submit Bitcoin deposit
          </button>
        </form>
      </section>
    </div>
  );
}
