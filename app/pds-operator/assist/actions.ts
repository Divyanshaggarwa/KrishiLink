"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type PdsLookupResult =
  | {
      ok: true;
      farmer: {
        id: string;
        full_name: string;
        krishilink_id: string;
        district: string | null;
        state: string | null;
      };
    }
  | { ok: false; error: string };

export async function lookupFarmerByKlid(
  rawId: string
): Promise<PdsLookupResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "pds_operator") {
    return { ok: false, error: "Only PDS operators can use this." };
  }

  const digits = rawId.replace(/\D/g, "");
  if (digits.length !== 6) {
    return { ok: false, error: "KrishiLink ID must be 6 digits (KL-XXXXXX)." };
  }

  const supabase = await createClient();
  const klid = `KL-${digits}`;

  const { data: farmer } = await supabase
    .from("public_profiles")
    .select("id, full_name, krishilink_id, district, state")
    .eq("krishilink_id", klid)
    .eq("role", "farmer")
    .maybeSingle();

  if (!farmer) {
    return { ok: false, error: "No farmer found with that KrishiLink ID." };
  }

  if (farmer.id === profile.id) {
    return { ok: false, error: "You cannot assist yourself." };
  }

  return { ok: true, farmer };
}

export type PdsListingState =
  | { ok: true; listingId: string }
  | { ok: false; error: string };

export async function pdsCreateListing(input: {
  farmerId: string;
  crop: string;
  quantityKg: number;
  grade: "A" | "B" | "C";
  expectedPricePerKg: number;
  harvestDate?: string;
  notes?: string;
}): Promise<PdsListingState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "pds_operator") {
    return {
      ok: false,
      error: "Only PDS operators can create assisted listings.",
    };
  }

  if (!input.crop || input.crop.trim().length < 2) {
    return { ok: false, error: "Crop name is required." };
  }
  if (!input.quantityKg || input.quantityKg <= 0) {
    return { ok: false, error: "Quantity must be greater than 0." };
  }
  if (!input.expectedPricePerKg || input.expectedPricePerKg <= 0) {
    return { ok: false, error: "Expected price must be greater than 0." };
  }
  if (!["A", "B", "C"].includes(input.grade)) {
    return { ok: false, error: "Invalid quality grade." };
  }

  const supabase = await createClient();

  const { data: farmer } = await supabase
    .from("public_profiles")
    .select("id, district, state")
    .eq("id", input.farmerId)
    .eq("role", "farmer")
    .maybeSingle();

  if (!farmer) {
    return { ok: false, error: "Farmer not found." };
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      farmer_id: input.farmerId,
      listed_by: profile.id,
      crop: input.crop.trim(),
      quantity_kg: input.quantityKg,
      quality_grade: input.grade,
      expected_price_per_kg: input.expectedPricePerKg,
      district: farmer.district ?? profile.district ?? "Unknown",
      state: farmer.state ?? profile.state ?? "Unknown",
      pincode: profile.pincode ?? null,
      harvest_date: input.harvestDate || null,
      notes: input.notes || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !listing) {
    return {
      ok: false,
      error: error?.message ?? "Could not create listing.",
    };
  }

  await supabase.from("notifications").insert({
    user_id: input.farmerId,
    kind: "pds_listing_created",
    title: `${input.crop} listed on your behalf`,
    body: `${profile.full_name} (PDS ${
      profile.pds_center_id ?? "Operator"
    }) created a listing for ${input.quantityKg} kg ${input.crop}.`,
    link: "/farmer/listings",
  });

  await supabase.rpc("bump_trust", {
    p_user: profile.id,
    p_delta: 1,
  });

  revalidatePath("/pds-operator");
  revalidatePath("/pds-operator/farmers");
  revalidatePath("/pds-operator/assist");
  revalidatePath("/farmer/listings");
  revalidatePath("/buyer/browse");

  return { ok: true, listingId: listing.id };
}