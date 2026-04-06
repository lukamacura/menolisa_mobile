import { apiFetchWithAuth } from './api';
import { Platform } from 'react-native';
import {
  clearTransactionIOS,
  endConnection,
  getSubscriptions,
  finishTransaction,
  getReceiptIOS,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  requestReceiptRefreshIOS,
  restorePurchases,
  type Purchase,
  type ProductCommon,
  type EventSubscription,
} from 'react-native-iap';

// Shared product IDs (must match App Store Connect).
export const IOS_SUBSCRIPTION_PRODUCTS = ['com.menolisa.app.monthly', 'com.menolisa.app.annual'] as const;
export type IosSubscriptionProductId = (typeof IOS_SUBSCRIPTION_PRODUCTS)[number];

export type IosIapVerifyReceiptResponse = {
  ok: boolean;
  active: boolean;
  expiresAt?: string | null;
  productId?: string | null;
};

let isConnected = false;
let listenersReady = false;
let purchaseUpdateSub: EventSubscription | null = null;
let purchaseErrorSub: EventSubscription | null = null;
let pendingPurchase:
  | {
      expectedProductId?: string;
      resolve: (res: IosIapVerifyReceiptResponse | null) => void;
      reject: (err: unknown) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  | null = null;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function verifyReceiptWithRetry(productId?: string): Promise<IosIapVerifyReceiptResponse> {
  // iOS receipts can be unavailable immediately after the purchase flow ends.
  // We refresh and retry to avoid "receipt-failed" race conditions.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await requestReceiptRefreshIOS();
      const receipt = await getReceiptIOS();
      return await verifyReceiptWithBackend({ receiptData: receipt, productId });
    } catch (err) {
      lastErr = err;
      await sleep(700 + attempt * 300);
    }
  }
  throw lastErr ?? new Error('Failed to verify receipt.');
}

export function isIosIapEnabled(): boolean {
  // This file is only resolved for iOS.
  return true;
}

export async function initIosIap(): Promise<void> {
  if (isConnected) return;
  await initConnection();
  isConnected = true;

  try { await clearTransactionIOS(); } catch {}


  if (listenersReady) return;
  listenersReady = true;

  purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
    if (!pendingPurchase) return;
    // iOS purchases may not include purchaseState; Android does.
    if (Platform.OS === 'android' && purchase.purchaseState !== 'purchased') return;
    if (pendingPurchase.expectedProductId && purchase.productId !== pendingPurchase.expectedProductId) return;

    try {
      const result = await verifyReceiptWithRetry(purchase.productId);
      pendingPurchase.resolve(result);
      // Finishing transactions is best-effort; entitlements are determined by receipt verification.
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Ignore finishTransaction failures; receipt verification already succeeded.
      }
    } catch (err) {
      pendingPurchase.reject(err);
    } finally {
      if (pendingPurchase) clearTimeout(pendingPurchase.timeoutId);
      pendingPurchase = null;
    }
  });

  purchaseErrorSub = purchaseErrorListener((error) => {
    if (!pendingPurchase) return;
    try {
      pendingPurchase.reject(new Error(error.message));
    } finally {
      clearTimeout(pendingPurchase.timeoutId);
      pendingPurchase = null;
    }
  });
}

export async function closeIosIap(): Promise<void> {
  pendingPurchase?.reject(new Error('IAP connection closed.'));
  pendingPurchase = null;
  purchaseUpdateSub?.remove();
  purchaseUpdateSub = null;
  purchaseErrorSub?.remove();
  purchaseErrorSub = null;
  listenersReady = false;
  isConnected = false;
  await endConnection();
}

export async function loadIosSubscriptions(): Promise<ProductCommon[]> {
  const products = await getSubscriptions({ skus: [...IOS_SUBSCRIPTION_PRODUCTS] });
  return (products ?? []) as ProductCommon[];
}

async function verifyReceiptWithBackend(params: {
  receiptData: string;
  productId?: string;
  transactionId?: string;
}): Promise<IosIapVerifyReceiptResponse> {
  const { receiptData, productId, transactionId } = params;
  return apiFetchWithAuth('/api/iap/verify-receipt', {
    method: 'POST',
    body: JSON.stringify({ receiptData, productId, transactionId }),
  }) as Promise<IosIapVerifyReceiptResponse>;
}

async function verifyFromCurrentReceipt(productId?: string): Promise<IosIapVerifyReceiptResponse | null> {
  const receipt = await getReceiptIOS();
  if (!receipt) return null;
  const result = await verifyReceiptWithBackend({ receiptData: receipt, productId });
  return result;
}

export async function buyIosSubscription(
  productId: IosSubscriptionProductId,
  appAccountToken?: string
): Promise<IosIapVerifyReceiptResponse | null> {
  if (!isConnected) {
    await initIosIap();
  }

  return new Promise<IosIapVerifyReceiptResponse | null>((resolve, reject) => {
    if (pendingPurchase) {
      reject(new Error('Another purchase is in progress.'));
      return;
    }

    const timeoutId = setTimeout(() => {
      pendingPurchase = null;
      resolve(null); // user likely cancelled or purchase didn’t finish in time
    }, 180_000); // 3 minutes

    pendingPurchase = {
      expectedProductId: productId,
      resolve,
      reject,
      timeoutId,
    };

    void requestPurchase({
      request: {
        apple: {
          sku: productId,
          andDangerouslyFinishTransactionAutomatically: false,
          // Tags this purchase with the Supabase user UUID so Apple Server
          // Notifications V2 can reconcile renewals/refunds back to the user.
          ...(appAccountToken ? { appAccountToken } : {}),
        },
      },
      type: 'subs',
    }).catch((err) => {
      if (!pendingPurchase) return;
      clearTimeout(pendingPurchase.timeoutId);
      pendingPurchase = null;
      reject(err);
    });
  });
}

export async function restoreIosPurchases(): Promise<IosIapVerifyReceiptResponse | null> {
  if (!isConnected) {
    await initIosIap();
  }
  await restorePurchases();
  // Restore can also be a race; retry receipt verification.
  try {
    return await verifyReceiptWithRetry();
  } catch {
    return verifyFromCurrentReceipt();
  }
}

export async function syncIosReceiptStatus(): Promise<IosIapVerifyReceiptResponse | null> {
  if (!isConnected) {
    await initIosIap();
  }
  // Use the existing receipt without refreshing — requestReceiptRefreshIOS() triggers
  // an Apple ID password prompt on iOS even for users who have never purchased.
  return verifyFromCurrentReceipt();
}

