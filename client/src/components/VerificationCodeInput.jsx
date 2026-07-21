export default function VerificationCodeInput({ value, onChange, disabled = false, label = "Verification code" }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      <input
        aria-label={label}
        autoComplete="one-time-code"
        className="mt-1 h-14 w-full rounded-2xl border border-emerald-100 bg-white/85 px-4 text-center text-2xl font-black tracking-[0.55em] text-market-navy outline-none focus:border-market-emerald disabled:opacity-60"
        disabled={disabled}
        inputMode="numeric"
        maxLength={6}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        pattern="[0-9]{6}"
        placeholder="000000"
        required
        value={value}
      />
    </label>
  );
}
