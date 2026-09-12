import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type UserRole = "farmer" | "buyer" | "pds_operator" | "admin";

export const ROLE_HOME: Record<UserRole, string> = {
  farmer: "/farmer",
  buyer: "/buyer",
  pds_operator: "/pds-operator",
  admin: "/admin",
};

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
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

  return profile;
}

export async function requireRole(allowed: UserRole[]) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!allowed.includes(profile.role as UserRole)) {
    redirect(ROLE_HOME[profile.role as UserRole] || "/");
  }
  return profile;
}