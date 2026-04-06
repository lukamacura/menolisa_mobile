import { Platform } from 'react-native';

// Shared product IDs (must match App Store Connect).
export const IOS_SUBSCRIPTION_PRODUCTS = ['com.menolisa.app.monthly', 'com.menolisa.app.annual'] as const;
export type IosSubscriptionProductId = (typeof IOS_SUBSCRIPTION_PRODUCTS)[number];

// IMPORTANT:
// Keep this file free of `react-native-iap` runtime imports so `expo start --web` works.
// The iOS-native implementation lives in `iap.ios.ts`.

export type IosIapVerifyReceiptResponse = {
  ok: boolean;
  active: boolean;
  expiresAt?: string | null;
  productId?: string | null;
};

export function isIosIapEnabled(): boolean {
  return Platform.OS === 'ios';
}

// No-op stubs for non-iOS platforms (web / android).
export async function initIosIap(): Promise<void> {}
export async function closeIosIap(): Promise<void> {}

// We intentionally return `any[]` so TS doesn't require importing iOS-only types in web.
export async function loadIosSubscriptions(): Promise<any[]> {
  return [];
}

export async function buyIosSubscription(
  _productId: IosSubscriptionProductId,
  _appAccountToken?: string
): Promise<IosIapVerifyReceiptResponse | null> {
  return null;
}

export async function restoreIosPurchases(): Promise<IosIapVerifyReceiptResponse | null> {
  return null;
}

export async function syncIosReceiptStatus(): Promise<IosIapVerifyReceiptResponse | null> {
  return null;
}


