import React, { createContext, useContext, useMemo } from 'react';

/**
 * Whether the medical disclaimer has been accepted on this device.
 *
 * It exists so that nothing else pops a modal while the disclaimer is still up.
 * `MedicalDisclaimerModal` is rendered by `AppNavigator` as a sibling of the
 * navigator, while `NotificationPromptModal` is rendered inside `MainTabs` — two
 * independent owners that, on a first launch, both decided to show at once. She
 * accepted the consent gate and found a second popup already waiting underneath
 * it, before she had seen a single screen. On Android two simultaneous RN
 * `Modal`s also z-order unreliably, so the consent gate could end up behind the
 * notification prompt entirely.
 *
 * A context rather than a second `AsyncStorage.getItem` in `MainTabs`: the read
 * has to re-run the moment she accepts, and polling storage for that is worse
 * than passing the boolean down. `AppNavigator` cannot be imported from
 * `MainTabs` directly — it imports `MainTabs` — hence its own module.
 *
 * Defaults to `false` so a consumer mounted outside the provider stays quiet
 * rather than assuming consent it cannot see.
 */
const MedicalConsentContext = createContext<boolean>(false);

export type MedicalConsentProviderProps = {
  accepted: boolean;
  children: React.ReactNode;
};

export function MedicalConsentProvider({ accepted, children }: MedicalConsentProviderProps) {
  const value = useMemo(() => accepted, [accepted]);
  return (
    <MedicalConsentContext.Provider value={value}>{children}</MedicalConsentContext.Provider>
  );
}

/**
 * True once the disclaimer is out of the way — either accepted just now or on a
 * previous launch. Gate any modal of your own on this.
 */
export function useMedicalConsentAccepted(): boolean {
  return useContext(MedicalConsentContext);
}
