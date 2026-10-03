"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type DemoRole =
  | "farmer1"
  | "farmer2"
  | "buyer1"
  | "buyer2"
  | "fpo"
  | "pds"
  | "admin";

const COOKIE_NAME = "krishilink_judge_demo";
const UNLOCK_SECONDS = 600; // 10 minutes

const ROLE_HOME: Record<DemoRole, string> = {
  farmer1: "/farmer",
  farmer2: "/farmer",
  buyer1: "/buyer",
  buyer2: "/buyer",
  fpo: "/farmer/fpo/dashboard",
  pds: "/pds-operator",
  admin: "/admin",
};

const ROLE_ENV: Record<DemoRole, { email: string; password: string }> = {
  farmer1: { email: "DEMO_FARMER1_EMAIL", password: "DEMO_FARMER1_PASSWORD" },
  farmer2: { email: "DEMO_FARMER2_EMAIL", password: "DEMO_FARMER2_PASSWORD" },
  buyer1: { email: "DEMO_BUYER1_EMAIL", password: "DEMO_BUYER1_PASSWORD" },
  buyer2: { email: "DEMO_BUYER2_EMAIL", password: "DEMO_BUYER2_PASSWORD" },
  fpo: { email: "DEMO_FPO_EMAIL", password: "DEMO_FPO_PASSWORD" },
  pds: { email: "DEMO_PDS_EMAIL", password: "DEMO_PDS_PASSWORD" },
  admin: { email: "DEMO_ADMIN_EMAIL", password: "DEMO_ADMIN_PASSWORD" },
};

/* ------------------------------------------------------------------ */
/*  Internal helper — parse the cookie and compute remaining time     */
/* ------------------------------------------------------------------ */
async function readUnlockState(): Promise<{
  unlocked: boolean;
  remainingSeconds: number;
}> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) return { unlocked: false, remainingSeconds: 0 };

  // Format: "unlocked.<expiresAtMs>"
  const [status, ts] = raw.split(".");
  if (status !== "unlocked" || !ts) {
    return { unlocked: false, remainingSeconds: 0 };
  }

  const expiresAt = Number(ts);
  if (!Number.isFinite(expiresAt)) {
    return { unlocked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  if (now >= expiresAt) {
    return { unlocked: false, remainingSeconds: 0 };
  }

  return {
    unlocked: true,
    remainingSeconds: Math.floor((expiresAt - now) / 1000),
  };
}

/* ------------------------------------------------------------------ */
/*  Public — client calls this to see state + time left               */
/* ------------------------------------------------------------------ */
export async function getJudgeDemoState(): Promise<{
  unlocked: boolean;
  remainingSeconds: number;
}> {
  return readUnlockState();
}

/* ------------------------------------------------------------------ */
/*  Unlock with PIN — stores expiry timestamp in cookie               */
/* ------------------------------------------------------------------ */
export type UnlockState = {
  ok: boolean;
  error?: string;
  remainingSeconds?: number;
};

export async function unlockJudgeDemoAction(
  _prev: UnlockState,
  formData: FormData
): Promise<UnlockState> {
  const pin = String(formData.get("pin") || "").trim();
  const expected = (process.env.JUDGE_DEMO_PIN || "").trim();

  if (!expected) {
    return {
      ok: false,
      error: "Judge Demo is not configured. Set JUDGE_DEMO_PIN in env.",
    };
  }

  if (!pin) {
    return { ok: false, error: "Enter the PIN." };
  }

  if (pin !== expected) {
    // Slow down brute-force
    await new Promise((r) => setTimeout(r, 800));
    return { ok: false, error: "Incorrect PIN." };
  }

  const expiresAtMs = Date.now() + UNLOCK_SECONDS * 1000;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `unlocked.${expiresAtMs}`, {
    maxAge: UNLOCK_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return { ok: true, remainingSeconds: UNLOCK_SECONDS };
}

/* ------------------------------------------------------------------ */
/*  Manual lock                                                       */
/* ------------------------------------------------------------------ */
export async function lockJudgeDemoAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/* ------------------------------------------------------------------ */
/*  Login as demo role — re-verifies active unlock                    */
/* ------------------------------------------------------------------ */
export async function demoLoginAction(role: DemoRole): Promise<void> {
  const state = await readUnlockState();
  if (!state.unlocked) {
    redirect("/?demo=locked");
  }

  const config = ROLE_ENV[role];
  if (!config) redirect("/?demo=invalid-role");

  const email = process.env[config.email];
  const password = process.env[config.password];

  if (!email || !password) {
    redirect(`/?demo=not-configured&role=${role}`);
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/?demo=login-failed&role=${role}`);
  }

  redirect(ROLE_HOME[role]);
}