import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/client.js";
import PasswordRequirements from "../components/PasswordRequirements.jsx";
import { passwordMeetsPolicy } from "../utils/passwordPolicy.js";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const passwordIsValid = passwordMeetsPolicy(form.password);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || !passwordIsValid) return;
    setMessage("");
    setSubmitting(true);
    try {
      await authApi.register(form);
      navigate(`/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
    } catch (error) {
      setMessage(error.message || "Unable to create your account right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Join SocialHub</p>
        <h1 className="text-2xl font-black text-market-navy">Create account</h1>
      </div>
      <form onSubmit={submit} className="glass-panel space-y-3 rounded-[1.35rem] p-4">
        <label className="block">
          <span className="text-xs font-bold text-gray-600">Email</span>
          <input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="mt-1 h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 outline-none focus:border-market-emerald" placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-gray-600">Password</span>
          <input type="password" autoComplete="new-password" required minLength={6} aria-describedby="registration-password-requirements" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="mt-1 h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 outline-none focus:border-market-emerald" placeholder="Create a strong password" />
        </label>
        <div id="registration-password-requirements"><PasswordRequirements password={form.password} /></div>
        <button disabled={submitting || !passwordIsValid} type="submit" className="tap-highlight brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Sending code..." : "Create account"}
        </button>
        {message && <p role="alert" className="text-sm font-semibold text-red-600">{message}</p>}
        <p className="text-center text-sm text-gray-600">Already registered? <Link to="/login" className="font-bold text-market-emerald">Login</Link></p>
      </form>
    </div>
  );
}
