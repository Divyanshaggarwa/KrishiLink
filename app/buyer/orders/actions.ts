"use server";

import {
  payEscrowFromWallet,
  confirmDeliveryFromWallet,
  type WalletActionResult,
} from "@/lib/wallet/actions";

export type OrderActionState = WalletActionResult;

export async function payEscrowAction(
  previous: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  return payEscrowFromWallet(previous, formData);
}

export async function confirmDeliveryAction(
  previous: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  return confirmDeliveryFromWallet(previous, formData);
}