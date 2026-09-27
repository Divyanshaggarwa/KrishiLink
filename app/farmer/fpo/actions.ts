"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type FpoAdminActionState = {
  ok: boolean;
  error?: string;
};

export async function approveFpoAction(
  _prev: FpoAdminActionState,
  formData: FormData
): Promise<FpoAdminActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Only admins can approve FPOs." };
  }

  const fpoHeadId = String(formData.get("fpoHeadId") || "");
  if (!fpoHeadId) return { ok: false, error: "Missing FPO head ID." };

  const supabase = await createClient();

  const { data: head } = await supabase
    .from("profiles")
    .select("id, fpo_status, fpo_name")
    .eq("id", fpoHeadId)
    .single();

  if (!head) return { ok: false, error: "FPO head not found." };
  if (head.fpo_status !== "pending") {
    return { ok: false, error: "This FPO is not pending." };
  }

  const { data: updatedRows, error } = await supabase
    .from("profiles")
    .update({
      fpo_status: "approved",
      fpo_approved_at: new Date().toISOString(),
      fpo_approved_by: profile.id,
    })
    .eq("id", fpoHeadId)
    .select("id, fpo_status, fpo_id");

  if (error) {
    return { ok: false, error: `Update failed: ${error.message}` };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return {
      ok: false,
      error: "Update matched no rows — RLS may still block admin.",
    };
  }

  const updatedHead = updatedRows[0];
  if (!updatedHead.fpo_id) {
    return {
      ok: false,
      error: "FPO ID was not generated. Check the trigger.",
    };
  }

  await supabase.from("notifications").insert({
    user_id: fpoHeadId,
    kind: "fpo_approved",
    title: "FPO approved",
    body: `"${head.fpo_name}" is now active. Visit your FPO dashboard.`,
    link: "/farmer/fpo/dashboard",
  });

  revalidatePath("/admin/fpo");
  revalidatePath("/admin");
  revalidatePath("/farmer");
  revalidatePath("/farmer/fpo");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/buyer");
  revalidatePath("/buyer/pools");

  return { ok: true };
}

export async function rejectFpoAction(
  _prev: FpoAdminActionState,
  formData: FormData
): Promise<FpoAdminActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Only admins can reject FPOs." };
  }

  const fpoHeadId = String(formData.get("fpoHeadId") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!fpoHeadId) return { ok: false, error: "Missing FPO head ID." };
  if (reason.length < 5) {
    return { ok: false, error: "Please provide a reason (min 5 characters)." };
  }

  const supabase = await createClient();

  const { data: updatedRows, error } = await supabase
    .from("profiles")
    .update({
      fpo_status: "rejected",
      fpo_rejection_reason: reason,
    })
    .eq("id", fpoHeadId)
    .select("id");

  if (error) {
    return { ok: false, error: `Update failed: ${error.message}` };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: "Update matched no rows." };
  }

  await supabase.from("notifications").insert({
    user_id: fpoHeadId,
    kind: "fpo_rejected",
    title: "FPO application rejected",
    body: reason,
    link: "/farmer/fpo",
  });

  revalidatePath("/admin/fpo");
  revalidatePath("/farmer/fpo");
  revalidatePath("/farmer");

  return { ok: true };
}