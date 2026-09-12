"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export type ListingState = { error?: string; ok?: boolean } | null;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function createListingAction(
  _prev: ListingState,
  formData: FormData
): Promise<ListingState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { error: "Only farmers can create listings." };
  }

  const crop = String(formData.get("crop") || "").trim();
  const variety = String(formData.get("variety") || "").trim();
  const quantity = Number(formData.get("quantity_kg"));
  const grade = String(formData.get("quality_grade") || "");
  const expectedPrice = Number(formData.get("expected_price_per_kg"));
  const harvestDate = String(formData.get("harvest_date") || "");
  const district = String(formData.get("district") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const pincode = String(formData.get("pincode") || "").trim();
  const fairLow = Number(formData.get("fair_price_low")) || null;
  const fairHigh = Number(formData.get("fair_price_high")) || null;
  const qualityConf = Number(formData.get("quality_confidence")) || null;
  const photo = formData.get("photo") as File | null;

  // Validation
  if (!crop) return { error: "Crop name is required." };
  if (!quantity || quantity <= 0)
    return { error: "Quantity must be greater than 0." };
  if (!["A", "B", "C"].includes(grade))
    return { error: "Quality grade is required." };
  if (!expectedPrice || expectedPrice <= 0)
    return { error: "Expected price must be greater than 0." };
  if (!district) return { error: "District is required." };
  if (!state) return { error: "State is required." };

  const supabase = await createClient();
  let photoUrl: string | null = null;

  // Upload photo
  if (photo && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return { error: "Photo must be smaller than 5 MB." };
    }
    if (!ALLOWED_TYPES.includes(photo.type)) {
      return { error: "Photo must be JPG, PNG, or WebP." };
    }

    const ext = photo.type.split("/")[1];
    const filename = `${profile.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("listing-photos")
      .upload(filename, photo, {
        contentType: photo.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Photo upload failed: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from("listing-photos")
      .getPublicUrl(filename);

    photoUrl = urlData.publicUrl;
  }

  // Insert listing
  const { error: insertError } = await supabase.from("listings").insert({
    farmer_id: profile.id,
    crop,
    variety: variety || null,
    quantity_kg: quantity,
    quality_grade: grade,
    quality_confidence: qualityConf,
    expected_price_per_kg: expectedPrice,
    fair_price_low: fairLow,
    fair_price_high: fairHigh,
    district,
    state,
    pincode: pincode || null,
    harvest_date: harvestDate || null,
    photo_url: photoUrl,
    status: "active",
  });

  if (insertError) {
    return { error: `Could not save listing: ${insertError.message}` };
  }

  redirect("/farmer/listings");
}