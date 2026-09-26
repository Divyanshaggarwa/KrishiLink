"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type FpoActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

/* --------------------------------------------------------------------
   Apply for FPO — members validated and inserted BEFORE the profile
   is flipped to pending. Prevents orphan FPO applications.
   -------------------------------------------------------------------- */
export async function applyForFpo(input: {
  fpoName: string;
  fpoRegion: string;
  members: { krishilink_id: string }[];
}): Promise<FpoActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { ok: false, error: "Only farmers can apply for FPO status." };
  }
  if (profile.fpo_status === "pending") {
    return { ok: false, error: "You already have a pending FPO application." };
  }
  if (profile.fpo_status === "approved") {
    return { ok: false, error: "You are already an approved FPO." };
  }

  const fpoName = input.fpoName.trim();
  const fpoRegion = input.fpoRegion.trim();

  const cleanedIds = input.members
    .map((m) => m.krishilink_id.trim().toUpperCase())
    .filter((id) => id.length > 0)
    .map((id) => (id.startsWith("KL-") ? id : `KL-${id.replace(/\D/g, "")}`));

  if (fpoName.length < 3) {
    return { ok: false, error: "FPO name must be at least 3 characters." };
  }
  if (fpoRegion.length < 2) {
    return { ok: false, error: "FPO region is required." };
  }
  if (cleanedIds.length < 2) {
    return {
      ok: false,
      error: "An FPO needs at least 2 member farmers besides yourself.",
    };
  }
  if (cleanedIds.length > 200) {
    return { ok: false, error: "Maximum 200 members per FPO application." };
  }

  // Validate KrishiLink ID format
  for (const id of cleanedIds) {
    if (!/^KL-\d{6}$/.test(id)) {
      return {
        ok: false,
        error: `Invalid KrishiLink ID format: ${id}. Use KL-XXXXXX.`,
      };
    }
    if (id === profile.krishilink_id) {
      return {
        ok: false,
        error: "You cannot add yourself as a member of your own FPO.",
      };
    }
  }

  // Check for duplicates
  const uniqueIds = Array.from(new Set(cleanedIds));
  if (uniqueIds.length !== cleanedIds.length) {
    return { ok: false, error: "Duplicate KrishiLink IDs found in the list." };
  }

  const supabase = await createClient();

  // Verify every ID exists via public_profiles (bypasses RLS safely)
  const { data: existingProfiles } = await supabase
    .from("public_profiles")
    .select("id, krishilink_id, role, full_name")
    .in("krishilink_id", uniqueIds);

  const foundIds = new Set(
    (existingProfiles || []).map((p) => p.krishilink_id)
  );
  const missing = uniqueIds.filter((id) => !foundIds.has(id));

  if (missing.length > 0) {
    return {
      ok: false,
      error: `These KrishiLink IDs don't exist: ${missing.join(", ")}`,
    };
  }

  // Ensure all are farmers
  const nonFarmers = (existingProfiles || []).filter(
    (p) => p.role !== "farmer"
  );
  if (nonFarmers.length > 0) {
    return {
      ok: false,
      error: `These accounts are not farmers: ${nonFarmers
        .map((p) => p.krishilink_id)
        .join(", ")}`,
    };
  }

  // ── STEP 1: Insert members FIRST ─────────────────────────────────
  const rows = (existingProfiles || []).map((p) => ({
    fpo_id: profile.id,
    member_id: p.id,
    member_krishilink_id: p.krishilink_id,
    member_phone: "",
    member_name: p.full_name,
    status: "pending" as const,
  }));

  // Clean any old pending rows from prior failed attempts
  await supabase
    .from("fpo_members")
    .delete()
    .eq("fpo_id", profile.id)
    .eq("status", "pending");

  const { error: memErr } = await supabase
    .from("fpo_members")
    .insert(rows);

  if (memErr) {
    return {
      ok: false,
      error: `Could not save members: ${memErr.message}`,
    };
  }

  // ── STEP 2: THEN flip the profile to pending ─────────────────────
  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      fpo_name: fpoName,
      fpo_region: fpoRegion,
      fpo_member_count: uniqueIds.length,
      fpo_status: "pending",
      fpo_applied_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (updErr) {
    // Roll back member rows so we don't leave orphans
    await supabase
      .from("fpo_members")
      .delete()
      .eq("fpo_id", profile.id)
      .eq("status", "pending");
    return { ok: false, error: updErr.message };
  }

  // ── STEP 3: Notify admins ────────────────────────────────────────
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    await supabase.from("notifications").insert(
      admins.map((a) => ({
        user_id: a.id,
        kind: "fpo_application",
        title: "New FPO application",
        body: `${profile.full_name} applied to register "${fpoName}" in ${fpoRegion} with ${uniqueIds.length} members.`,
        link: "/admin/fpo",
      }))
    );
  }

  revalidatePath("/farmer");
  revalidatePath("/farmer/fpo");
  revalidatePath("/admin/fpo");

  return { ok: true };
}

/* --------------------------------------------------------------------
   Get the FPO info of the current user
   -------------------------------------------------------------------- */
export async function getMyFpo(): Promise<FpoActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();

  // Case 1: this user is an FPO head
  if (profile.fpo_status) {
    const { data: members } = await supabase
      .from("fpo_members")
      .select(
        "id, member_name, member_krishilink_id, status, joined_at, member_id"
      )
      .eq("fpo_id", profile.id)
      .order("joined_at", { ascending: false });

    return {
      ok: true,
      data: {
        role: "head",
        fpo_name: profile.fpo_name,
        fpo_region: profile.fpo_region,
        fpo_id: profile.fpo_id,
        fpo_status: profile.fpo_status,
        fpo_member_count: profile.fpo_member_count,
        rejection_reason: profile.fpo_rejection_reason,
        members: members || [],
      },
    };
  }

  // Case 2: this user is a member of some FPO
  const { data: membership } = await supabase
    .from("fpo_members")
    .select("id, status, fpo_id, joined_at")
    .eq("member_id", profile.id)
    .maybeSingle();

  if (membership) {
    const { data: fpo } = await supabase
      .from("public_profiles")
      .select("full_name, fpo_name, fpo_region, fpo_id, fpo_status")
      .eq("id", membership.fpo_id)
      .single();

    return {
      ok: true,
      data: {
        role: "member",
        membership: { ...membership, fpo },
      },
    };
  }

  return { ok: true, data: { role: "none" } };
}