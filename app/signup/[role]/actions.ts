"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  normalizeIndianPhone,
  isValidIndianPhone,
} from "@/lib/phone";

const VALID_ROLES = ["farmer", "buyer", "pds-operator", "admin"] as const;
type UrlRole = (typeof VALID_ROLES)[number];

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

export type SignupState = { error?: string } | null;

export async function signupAction(
  urlRole: UrlRole,
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  if (!VALID_ROLES.includes(urlRole)) {
    return { error: "Invalid signup role." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const addressLine1 = String(formData.get("address_line1") || "").trim();
  const addressLine2 = String(formData.get("address_line2") || "").trim();
  const landmark = String(formData.get("landmark") || "").trim();
  const village = String(formData.get("village") || "").trim();
  const district = String(formData.get("district") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const pincode = String(formData.get("pincode") || "").trim();

  // Validation — ALL mandatory fields
  if (!fullName) return { error: "Full name is required." };
  if (!email) return { error: "Email is required." };
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!phoneRaw) return { error: "Mobile number is required." };
  if (!isValidIndianPhone(phoneRaw)) {
    return { error: "Please enter a valid 10-digit Indian mobile number." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (!addressLine1) return { error: "Address line 1 is required." };
  if (!district) return { error: "District is required." };
  if (!state) return { error: "State is required." };
  if (!/^\d{6}$/.test(pincode)) {
    return { error: "Please enter a valid 6-digit PIN code." };
  }

  if (urlRole === "admin") {
    const code = String(formData.get("admin_code") || "");
    const expected = process.env.NEXT_PUBLIC_ADMIN_SIGNUP_CODE || "";
    if (!expected || code !== expected) {
      return { error: "Invalid admin signup code." };
    }
  }

  const normalizedPhone = normalizeIndianPhone(phoneRaw);

  const meta: Record<string, string> = {
    role: ROLE_MAP[urlRole],
    full_name: fullName,
    phone: normalizedPhone,
    address_line1: addressLine1,
    address_line2: addressLine2,
    landmark,
    village,
    district,
    state,
    pincode,
    language: String(formData.get("language") || "en"),
  };

  if (urlRole === "buyer") {
    meta.business_name = String(formData.get("business_name") || "").trim();
    meta.gst_number = String(formData.get("gst_number") || "").trim();
  }
  if (urlRole === "pds-operator") {
    meta.pds_center_id = String(formData.get("pds_center_id") || "").trim();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return {
        error: "This email is already registered. Try signing in with it.",
      };
    }
    return { error: error.message };
  }

  redirect(HOME_MAP[urlRole]);
}