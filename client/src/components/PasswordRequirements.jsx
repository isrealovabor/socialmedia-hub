import { Check, Circle } from "lucide-react";
import { PASSWORD_POLICY_MESSAGE, PASSWORD_REQUIREMENTS, passwordValidation } from "../utils/passwordPolicy.js";

export default function PasswordRequirements({ password }) {
  const checks = passwordValidation(password);

  return (
    <div className="rounded-2xl bg-emerald-50/70 p-3" aria-live="polite">
      <p className="sr-only">{PASSWORD_POLICY_MESSAGE}</p>
      <ul className="grid gap-1.5 text-xs">
        {PASSWORD_REQUIREMENTS.map((requirement) => {
          const passed = checks[requirement.key];
          const Icon = passed ? Check : Circle;
          return (
            <li key={requirement.key} className={passed ? "flex items-center gap-2 font-semibold text-emerald-700" : "flex items-center gap-2 text-gray-500"}>
              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span>{requirement.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
