import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi, setToken } from "../api/client.js";
import VerificationCodeInput from "../components/VerificationCodeInput.jsx";

export default function VerifyEmailPage({ onAuth }) {
  const [params] = useSearchParams();
  const email = (params.get("email") || "").trim().toLowerCase();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const verify = async (event) => {
    event.preventDefault();
    if (submitting || code.length !== 6) return;
    setSubmitting(true);
    setMessage("");
    try {
      const data = await authApi.verifyEmail({ email, code });
      setToken(data.token);
      onAuth(data);
    } catch (error) {
      setMessage(error.message || "Unable to verify this code.");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (submitting || cooldown > 0) return;
    setSubmitting(true);
    setMessage("");
    try {
      const data = await authApi.resendVerification({ email });
      setMessage(data.message);
      setCode("");
      setCooldown(data.cooldownSeconds || 60);
    } catch (error) {
      setMessage(error.message || "Unable to send another code.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!email) {
    return <section className="glass-panel rounded-[1.35rem] p-4"><h1 className="text-xl font-black text-market-navy">Email required</h1><Link className="mt-3 inline-flex text-sm font-bold text-market-emerald" to="/register">Return to registration</Link></section>;
  }

  return (
    <section className="glass-panel rounded-[1.35rem] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Check your inbox</p>
      <h1 className="mt-1 text-xl font-black text-market-navy">Verify your email</h1>
      <p className="mt-2 text-sm leading-6 text-gray-600">Enter the six-digit code sent to <strong>{email}</strong>. It expires in 10 minutes.</p>
      <form onSubmit={verify} className="mt-4 space-y-3">
        <VerificationCodeInput value={code} onChange={setCode} disabled={submitting} />
        <button disabled={submitting || code.length !== 6} className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow disabled:opacity-60">{submitting ? "Verifying..." : "Verify and continue"}</button>
      </form>
      <button type="button" disabled={submitting || cooldown > 0} onClick={resend} className="mt-3 w-full text-sm font-bold text-market-emerald disabled:text-gray-400">
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend verification code"}
      </button>
      {message && <p role="status" className="mt-3 text-sm font-semibold text-gray-700">{message}</p>}
      <Link className="mt-3 inline-flex text-sm font-bold text-market-emerald" to="/register">Use another email</Link>
    </section>
  );
}
