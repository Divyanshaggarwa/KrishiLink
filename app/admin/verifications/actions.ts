"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type VerificationActionState = {
  ok: boolean;
  error?: string;
};

export async function approveVerificationAction(
  _prev: VerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") {
    return { ok: false, error: "Only admins can approve accounts." };
  }

  const userId = String(formData.get("userId") || "");
  if (!userId) return { ok: false, error: "Missing user ID." };

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      verification_status: "verified",
      verification_reviewed_at: new Date().toISOString(),
      verification_reviewed_by: admin.id,
      verification_notes: null,
    })
    .eq("id", userId)
    .select("id, full_name")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Update failed." };
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    kind: "account_verified",
    title: "Account verified",
    body: "Your KrishiLink account has been verified. You now have full access to the ecosystem.",
    link: "/",
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectVerificationAction(
  _prev: VerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") {
    return { ok: false, error: "Only admins can reject accounts." };
  }

  const userId = String(formData.get("userId") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!userId) return { ok: false, error: "Missing user ID." };
  if (reason.length < 5) {
    return { ok: false, error: "Reason must be at least 5 characters." };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      verification_status: "rejected",
      verification_reviewed_at: new Date().toISOString(),
      verification_reviewed_by: admin.id,
      verification_notes: reason,
    })
    .eq("id", userId)
    .select("id")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Update failed." };
  }

  await supabase.from("notifications").insert({
    user_id: userId,
    kind: "account_rejected",
    title: "Verification rejected",
    body: reason,
    link: "/",
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/admin");
  return { ok: true };
}