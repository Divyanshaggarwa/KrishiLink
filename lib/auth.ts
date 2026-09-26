import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type UserRole = "farmer" | "buyer" | "pds_operator" | "admin";

export const ROLE_HOME: Record<UserRole, string> = {
  farmer: "/farmer",
  buyer: "/buyer",
  pds_operator: "/pds-operator",
  admin: "/admin",
};

/**
 * Shape of a row from the `profiles` table.
 * Keep this in sync with the SQL schema.
 */
export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  krishilink_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  language: string | null;
  is_verified: boolean | null;
  trust_score: number | null;
  pds_center_id: string | null;
  business_name: string | null;
  gst_number: string | null;
  // FPO fields
  fpo_name: string | null;
  fpo_region: string | null;
  fpo_status: "pending" | "approved" | "rejected" | null;
  fpo_member_count: number | null;
  fpo_head_id: string | null;
  fpo_id: string | null;              // NEW: KF-XXXXXX
  fpo_applied_at: string | null;
  fpo_approved_at: string | null;
  fpo_approved_by: string | null;
  fpo_rejection_reason: string | null;
  // End FPO
  created_at: string;
  updated_at: string;
};

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile | null) ?? null;
}

export async function requireRole(allowed: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!allowed.includes(profile.role as UserRole)) {
    redirect(ROLE_HOME[profile.role as UserRole] || "/");
  }
  return profile;
}