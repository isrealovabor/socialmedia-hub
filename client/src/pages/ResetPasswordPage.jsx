import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/client.js";
import VerificationCodeInput from "../components/VerificationCodeInput.jsx";
import PasswordRequirements from "../components/PasswordRequirements.jsx";
import { passwordMeetsPolicy } from "../utils/passwordPolicy.js";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = (params.get("email") || "").trim().toLowerCase();
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [passwords, setPasswords] = useState({ password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [complete, setComplete] = useState(false);
  const passwordIsValid = passwordMeetsPolicy(passwords.password);
  const passwordsMatch = passwords.password === passwords.confirmPassword;

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const verifyCode = async (event) => {
    event.preventDefault();
    if (submitting || code.length !== 6) return;
    setSubmitting(true);
    setMessage("");
    try {
      const data = await authApi.verifyResetCode({ email, code });
      setResetToken(data.resetToken);
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
      const data = await authApi.forgotPassword({ email });
      setMessage(data.message);
      setCode("");
      setCooldown(data.cooldownSeconds || 60);
    } catch (error) {
      setMessage(error.message || "Unable to send another code.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (submitting || !passwordIsValid || !passwordsMatch) return;
    setSubmitting(true);
    setMessage("");
    try {
      const data = await authApi.resetPassword({ resetToken, ...passwords });
      setMessage(data.message);
      setComplete(true);
    } catch (error) {
      setMessage(error.message || "Unable to reset your password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!email) {
    return <section className="glass-panel rounded-[1.35rem] p-4"><h1 className="text-xl font-black text-market-navy">Email required</h1><Link className="mt-3 inline-flex text-sm font-bold text-market-emerald" to="/forgot-password">Start password recovery</Link></section>;
  }

  if (complete) {
    return <section className="glass-panel rounded-[1.35rem] p-4 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-market-emerald">✓</div><h1 className="mt-3 text-xl font-black text-market-navy">Password reset complete</h1><p className="mt-2 text-sm text-gray-600">Your old password and existing sessions are no longer valid.</p><Link className="brand-gradient mt-4 inline-flex h-11 items-center rounded-full px-6 text-sm font-black text-white" to="/login">Continue to login</Link></section>;
  }

  return (
    <section className="glass-panel rounded-[1.35rem] p-4">
      <h1 className="text-xl font-black text-market-navy">Reset password</h1>
      {!resetToken ? (
        <>
          <p className="mt-2 text-sm leading-6 text-gray-600">Enter the six-digit code sent to <strong>{email}</strong>.</p>
          <form onSubmit={verifyCode} className="mt-4 space-y-3">
            <VerificationCodeInput value={code} onChange={setCode} disabled={submitting} label="Password reset code" />
            <button disabled={submitting || code.length !== 6} className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow disabled:opacity-60">{submitting ? "Checking code..." : "Continue"}</button>
          </form>
          <button type="button" disabled={submitting || cooldown > 0} onClick={resend} className="mt-3 w-full text-sm font-bold text-market-emerald disabled:text-gray-400">{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend reset code"}</button>
        </>
      ) : (
        <form onSubmit={resetPassword} className="mt-4 space-y-3">
          <label className="block"><span className="text-xs font-bold text-gray-600">New password</span><input autoComplete="new-password" className="mt-1 h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3" minLength={6} required type="password" aria-describedby="reset-password-requirements" value={passwords.password} onChange={(event) => setPasswords((value) => ({ ...value, password: event.target.value }))} /></label>
          <div id="reset-password-requirements"><PasswordRequirements password={passwords.password} /></div>
          <label className="block"><span className="text-xs font-bold text-gray-600">Confirm new password</span><input autoComplete="new-password" className="mt-1 h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3" minLength={6} required type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords((value) => ({ ...value, confirmPassword: event.target.value }))} /></label>
          {passwords.confirmPassword && !passwordsMatch && <p role="alert" className="text-xs font-semibold text-red-600">Passwords do not match.</p>}
          <button disabled={submitting || !passwordIsValid || !passwordsMatch} className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Updating password..." : "Set new password"}</button>
        </form>
      )}
      {message && <p role="status" className="mt-3 text-sm font-semibold text-gray-700">{message}</p>}
      <Link className="mt-3 inline-flex text-sm font-bold text-market-emerald" to="/login">Back to login</Link>
    </section>
  );
}
