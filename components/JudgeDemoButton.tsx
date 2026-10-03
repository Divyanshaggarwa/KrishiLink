"use client";

import { useState, useTransition, useEffect, useActionState } from "react";
import {
  demoLoginAction,
  unlockJudgeDemoAction,
  getJudgeDemoState,
  lockJudgeDemoAction,
  type DemoRole,
  type UnlockState,
} from "@/app/demo/actions";
import ButtonSpinner from "@/components/ButtonSpinner";

type RoleOption = {
  key: DemoRole;
  label: string;
  desc: string;
  icon: string;
};

const GROUPS: { title: string; roles: RoleOption[] }[] = [
  {
    title: "Farmer",
    roles: [
      {
        key: "farmer1",
        label: "Farmer 1 — Nashik",
        desc: "2 listings · 2 offers received · ₹10,000 wallet",
        icon: "🌾",
      },
      {
        key: "farmer2",
        label: "Farmer 2 — Pune",
        desc: "2 listings · 2 offers received · ₹8,000 wallet",
        icon: "🌱",
      },
    ],
  },
  {
    title: "Buyer",
    roles: [
      {
        key: "buyer1",
        label: "Buyer 1 — Wholesaler",
        desc: "2 active bids · ₹50,000 wallet",
        icon: "🏪",
      },
      {
        key: "buyer2",
        label: "Buyer 2 — Bulk Trader",
        desc: "2 active bids · ₹40,000 wallet",
        icon: "🛒",
      },
    ],
  },
  {
    title: "FPO & Admin",
    roles: [
      {
        key: "fpo",
        label: "FPO Head",
        desc: "Collective pool · member splits · FPO wallet",
        icon: "🏛️",
      },
      {
        key: "pds",
        label: "PDS Operator",
        desc: "Assisted access kiosk for feature-phone farmers",
        icon: "🎧",
      },
      {
        key: "admin",
        label: "Admin Panel",
        desc: "Verifications · orders · fees · disputes",
        icon: "🛡️",
      },
    ],
  },
];

const INITIAL_UNLOCK: UnlockState = { ok: false };

export default function JudgeDemoButton() {
  const [open, setOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pendingRole, setPendingRole] = useState<DemoRole | null>(null);
  const [isPending, startTransition] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [pin, setPin] = useState("");
  const [unlockState, unlockAction, isUnlocking] = useActionState<
    UnlockState,
    FormData
  >(unlockJudgeDemoAction, INITIAL_UNLOCK);

  /* ----- On open: ask server for current state + remaining time ----- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setIsChecking(true);
      const state = await getJudgeDemoState();
      if (cancelled) return;
      setUnlocked(state.unlocked);
      setSecondsLeft(state.remainingSeconds);
      setIsChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  /* ----- When PIN unlock succeeds, adopt server's remaining time ----- */
  useEffect(() => {
    if (unlockState.ok && unlockState.remainingSeconds !== undefined) {
      setUnlocked(true);
      setSecondsLeft(unlockState.remainingSeconds);
    }
  }, [unlockState.ok, unlockState.remainingSeconds]);

  /* ----- Countdown — runs only while modal is open and unlocked ----- */
  useEffect(() => {
    if (!open || !unlocked) return;
    if (secondsLeft <= 0) {
      setUnlocked(false);
      return;
    }

    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setUnlocked(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [open, unlocked, secondsLeft]);

  function trigger(role: DemoRole) {
    setPendingRole(role);
    startTransition(async () => {
      await demoLoginAction(role);
    });
  }

  async function handleLock() {
    await lockJudgeDemoAction();
    setUnlocked(false);
    setSecondsLeft(0);
    setPin("");
    setOpen(false);
  }

  function closeModal() {
    if (isPending || isUnlocking) return;
    setOpen(false);
    setPin("");
  }

  const minutesLeft = Math.floor(secondsLeft / 60);
  const secondsRemaining = secondsLeft % 60;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-1.5 rounded-full bg-[#FFF8E1] px-3.5 py-1.5 text-xs font-semibold text-[#B26A00] transition-colors hover:bg-[#FFE082] sm:inline-flex"
      >
        🎯 Judge Demo
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF8E1] text-sm sm:hidden"
        aria-label="Judge demo"
      >
        🎯
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeModal}
            aria-hidden="true"
          />

          <div className="fixed left-1/2 top-20 z-50 w-full max-w-md -translate-x-1/2 px-4">
            <div
              className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white shadow-[0_30px_80px_-20px_rgba(27,77,62,0.4)]"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[#E4EBE6] bg-gradient-to-br from-[#FFF8E1] to-white px-6 py-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#B26A00]">
                    🎯 Judge Demo Mode
                  </p>
                  <h3 className="font-display mt-1 text-lg font-bold text-[#0F1F1A]">
                    {unlocked ? "Choose a role to explore" : "Enter access PIN"}
                  </h3>
                  <p className="mt-1 text-xs text-[#6B7A74]">
                    {unlocked
                      ? "Pre-loaded data · No signup needed"
                      : "Restricted to judges and the core team"}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  disabled={isPending || isUnlocking}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6B7A74] transition-colors hover:bg-white/80 hover:text-[#1B4D3E] disabled:opacity-40"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="max-h-[70vh] overflow-y-auto p-5">
                {isChecking ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <ButtonSpinner size={20} />
                    <p className="text-xs text-[#6B7A74]">Checking access…</p>
                  </div>
                ) : !unlocked ? (
                  /* ---- PIN form ---- */
                  <form action={unlockAction} className="space-y-4">
                    <div className="rounded-xl border border-[#FFF8E1] bg-[#FFFCF5] p-3 text-[11px] text-[#B26A00]">
                      🔒 Judge Demo is locked. Enter the PIN to unlock for 10
                      minutes.
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#0F1F1A]">
                        Access PIN
                      </label>
                      <input
                        name="pin"
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        autoFocus
                        placeholder="Enter PIN"
                        className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
                      />
                    </div>

                    {unlockState.error && (
                      <p className="rounded-lg bg-[#FFF5F5] p-2.5 text-center text-xs text-[#C62828]">
                        {unlockState.error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isUnlocking || !pin.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUnlocking ? (
                        <>
                          <ButtonSpinner size={14} /> Unlocking…
                        </>
                      ) : (
                        "Unlock Judge Demo"
                      )}
                    </button>

                    <p className="text-center text-[10px] text-[#6B7A74]">
                      Access auto-locks after 10 minutes.
                    </p>
                  </form>
                ) : (
                  /* ---- Role selection ---- */
                  <>
                    <div className="mb-4 flex items-center justify-between rounded-xl border border-[#A5D6A7] bg-[#EAF5EE] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#2E7D32]" />
                        <span className="text-[11px] font-semibold text-[#2E7D32]">
                          Unlocked · locks in {minutesLeft}:
                          {String(secondsRemaining).padStart(2, "0")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLock}
                        className="text-[10px] font-medium text-[#C62828] hover:underline"
                      >
                        Lock now
                      </button>
                    </div>

                    <div className="space-y-4">
                      {GROUPS.map((group) => (
                        <div key={group.title}>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
                            {group.title}
                          </p>
                          <div className="space-y-2">
                            {group.roles.map((r) => (
                              <button
                                key={r.key}
                                type="button"
                                onClick={() => trigger(r.key)}
                                disabled={isPending}
                                className="group flex w-full items-center gap-3 rounded-xl border border-[#E4EBE6] bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#2E7D32] hover:bg-[#FAFCFA] hover:shadow-[0_10px_20px_-10px_rgba(27,77,62,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5EE] text-lg">
                                  {r.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold text-[#0F1F1A]">
                                    {r.label}
                                  </span>
                                  <span className="block text-[11px] text-[#6B7A74]">
                                    {r.desc}
                                  </span>
                                </span>
                                {isPending && pendingRole === r.key ? (
                                  <ButtonSpinner size={14} />
                                ) : (
                                  <span className="text-[#2E7D32] opacity-0 transition-opacity group-hover:opacity-100">
                                    →
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <a
                        href="/ivr-sim"
                        className="flex items-center gap-3 rounded-xl border border-[#C8E6C9] bg-[#EAF5EE] p-3.5 transition-colors hover:bg-[#DCEFE0]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg">
                          📞
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[#1B4D3E]">
                            Try IVR Demo
                          </span>
                          <span className="block text-[11px] text-[#2E7D32]/80">
                            Simulated phone call · No login
                          </span>
                        </span>
                        <span className="text-[#2E7D32]">→</span>
                      </a>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-[#E4EBE6] bg-[#FAFCFA] px-6 py-3 text-center">
                <p className="text-[10px] text-[#6B7A74]">
                  All Demo Accounts Are Password Protected.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}