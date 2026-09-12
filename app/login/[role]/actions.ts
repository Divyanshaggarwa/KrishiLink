"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  normalizeIndianPhone,
  looksLikeEmail,
} from "@/lib/phone";

const VALID = ["farmer", "buyer", "pds-operator", "admin"] as const;
type UrlRole = (typeof VALID)[number];

const ROLE_MAP: Record<UrlRole, string> = {
  farmer: "farmer",
  buyer: "buyer",
  "pds-operator": "pds_operator",
  admin: "admin",
};

const HOME_MAP: Record<UrlRole, string> = {
  farmer: "/farmer",
  buyer: "/buyer",
  "pds-operator": "/pds-operator",
  admin: "/admin",
};

export type LoginState = { error?: string } | null;

export async function loginAction(
  urlRole: UrlRole,
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!VALID.includes(urlRole)) return { error: "Invalid role." };

  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");

  if (!identifier) {
    return { error: "Email or mobile number is required." };
  }
  if (!password) {
    return { error: "Password is required." };
  }

  const supabase = await createClient();

  let email: string;

  if (looksLikeEmail(identifier)) {
    email = identifier.toLowerCase();
  } else {
    const normalized = normalizeIndianPhone(identifier);
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      return {
        error:
          "Please enter a valid 10-digit Indian mobile number or an email address.",
      };
    }

    const { data: foundEmail, error: rpcError } = await supabase.rpc(
      "find_email_by_phone",
      { p_phone: normalized }
    );

    if (rpcError) {
      return { error: "Could not look up that mobile number. Try email login." };
    }
    if (!foundEmail) {
      return { error: "No account found with that mobile number." };
    }

    email = foundEmail as string;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Invalid credentials." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const expected = ROLE_MAP[urlRole];
  if (profile?.role !== expected) {
    await supabase.auth.signOut();
    return {
      error: `This account is not registered as a ${urlRole.replace(
        "-",
        " "
      )}. Please use the correct sign-in page.`,
    };
  }

  redirect(HOME_MAP[urlRole]);
}