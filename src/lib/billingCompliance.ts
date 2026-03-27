import { Alert, Linking, Platform } from 'react-native';

export type BillingRoute = 'external_purchase' | 'iap';

export function resolveBillingRoute(): BillingRoute {
  if (Platform.OS === 'ios') return 'iap';
  return 'external_purchase';
}

export function getBillingDestinationLabel(): string {
  return resolveBillingRoute() === 'iap' ? 'App Store' : 'website checkout';
}

export async function confirmExternalPurchaseRedirect(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return window.confirm('You are about to leave the app to complete your purchase on our website.');
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Continue to website',
      'You are leaving the app to complete your purchase on our website.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ]
    );
  });
}

export async function openIapManagePage(): Promise<void> {
  const url = Platform.OS === 'ios'
    ? 'itms-apps://apps.apple.com/account/subscriptions'
    : 'https://apps.apple.com/account/subscriptions';
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) throw new Error('Unable to open App Store subscriptions page.');
  await Linking.openURL(url);
}
