import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/client.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      await authApi.forgotPassword({ email });
      navigate(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (error) {
      setMessage(error.message || "Unable to start password recovery.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="glass-panel rounded-[1.35rem] p-4">
      <h1 className="text-xl font-black text-market-navy">Forgot password?</h1>
      <p className="mt-2 text-sm leading-6 text-gray-600">Enter your email and we’ll send a six-digit reset code if an account is available.</p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input aria-label="Email" autoComplete="email" className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" required />
        <button disabled={submitting} className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow disabled:opacity-60">{submitting ? "Sending code..." : "Send reset code"}</button>
      </form>
      {message && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{message}</p>}
      <Link className="mt-3 inline-flex text-sm font-bold text-market-emerald" to="/login">Back to login</Link>
    </section>
  );
}
