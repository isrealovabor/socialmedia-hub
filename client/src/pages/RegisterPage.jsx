import { useState } from "react";
import { authApi, setToken } from "../api/client.js";

export default function RegisterPage({ onAuth }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const data = await authApi.register(form);
      setToken(data.token);
      onAuth(data);
    } catch (error) {
      setMessage(error.message);
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
          <span className="text-xs font-bold text-gray-600">Full name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="mt-1 h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 outline-none focus:border-market-emerald"
            placeholder="Your name"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-gray-600">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="mt-1 h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 outline-none focus:border-market-emerald"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-gray-600">Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="mt-1 h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 outline-none focus:border-market-emerald"
            placeholder="Create password"
          />
        </label>
        <button
          type="submit"
          className="tap-highlight brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow"
        >
          Create account
        </button>
        {message && <p className="text-sm font-semibold text-red-600">{message}</p>}
      </form>
    </div>
  );
}
