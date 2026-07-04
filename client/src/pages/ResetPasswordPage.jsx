import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/client.js";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const data = await authApi.resetPassword({ token, password });
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <section className="glass-panel rounded-[1.35rem] p-4">
      <h1 className="text-xl font-black text-market-navy">Reset Password</h1>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <input className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" type="password" required />
        <button className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow">Reset password</button>
      </form>
      {message && <p className="mt-3 text-sm font-semibold text-gray-700">{message}</p>}
      <Link className="mt-3 inline-flex text-sm font-bold text-market-emerald" to="/login">Login</Link>
    </section>
  );
}
