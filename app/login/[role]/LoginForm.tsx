"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";

type UrlRole = "farmer" | "buyer" | "pds-operator" | "admin";

export default function LoginForm({ role }: { role: UrlRole }) {
  const bound = loginAction.bind(null, role);
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    bound,
    null
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="text-xs font-medium text-[#0F1F1A]">
          Email or Mobile number <span className="text-[#C62828]">*</span>
        </label>
        <input
          name="identifier"
          type="text"
          required
          placeholder="you@example.com or 9876543210"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
        />
        <p className="mt-1.5 text-[11px] text-[#6B7A74]">
          You can sign in with either your email address or your registered
          mobile number.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-[#0F1F1A]">
          Password <span className="text-[#C62828]">*</span>
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
        />
      </div>

      {state?.error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-[#1B4D3E] px-6 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}