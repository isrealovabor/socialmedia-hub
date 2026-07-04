import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/client.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const data = await authApi.forgotPassword({ email });
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <section className="glass-panel rounded-[1.35rem] p-4">
      <h1 className="text-xl font-black text-market-navy">Forgot Password</h1>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" required />
        <button className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow">Send reset link</button>
      </form>
      {message && <p className="mt-3 text-sm font-semibold text-gray-700">{message}</p>}
      <Link className="mt-3 inline-flex text-sm font-bold text-market-emerald" to="/login">Back to login</Link>
    </section>
  );
}
