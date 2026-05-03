Good progress. Before you hit "build", let me pressure-test these 5 changes as a senior dev would in a real code review.

Code Review — Pre-Build Audit
✅ src/lib/iap.ios.ts — Solid, one concern
The core fixes are correct. The one thing worth double-checking:
getAvailablePurchases({ onlyIncludeActiveItemsIOS: true }) — verify this option exists in your installed v14 type definitions right now:
bashgrep -r "onlyIncludeActiveItemsIOS" node_modules/react-native-iap/src
This parameter existed in v13 but v14 restructured several method signatures. If it's not in the types, the call will silently ignore the option and return all purchases including expired ones — which means your restore logic may incorrectly re-finish old transactions. If it's missing, the safe fallback is:
typescriptconst purchases = await getAvailablePurchases();
// then filter manually:
const active = purchases.filter(p => 
  !p.expirationDateIOS || new Date(p.expirationDateIOS) > new Date()
);

✅ app.json — Fine
Version bump is clean. Nothing to flag.

⚠️ app.config.js — 15.1 vs 15.0
The library requires iOS 15.0+. You pinned 15.1. That's not wrong, but be deliberate about it — 15.1 excludes users on exactly 15.0, which is a small but real slice of devices. Unless you have a specific reason for 15.1 (e.g. a StoreKit 2 API that was buggy in 15.0), change it to '15.0' to maximize reach.

⚠️ package.json — Version pin needs scrutiny
You added react-native-nitro-modules: ^0.35.0. Before building, verify this version is actually compatible with your installed react-native-iap version:
bash# Check what version of nitro-modules react-native-iap v14 expects
cat node_modules/react-native-iap/package.json | grep nitro
The react-native-iap GitHub Discussion #3025 flagged Nitro compatibility issues between minor versions. If there's a mismatch, you'll get a cryptic native crash at runtime, not a build error. Pin to whatever version react-native-iap lists as its peer dependency — not independently to ^0.35.0.

🔴 One Thing Claude Code Didn't Touch — Check This
Purchase listener cleanup. Now that finishTransaction() is being called in the restore loop, make sure your purchaseUpdatedListener is not also calling finishTransaction() on the same transactions during a restore flow. Double-finishing a transaction on iOS throws a SKErrorDomain error that's hard to debug. The pattern should be:
typescript// Make sure your listener has a guard like this:
purchaseUpdatedListener(async (purchase) => {
  if (purchase.isAcknowledgedAndroid || purchase.transactionStateIOS === 'restored') {
    return; // already handled by restore flow
  }
  await finishTransaction({ purchase, isConsumable: false });
});

Pre-Build Checklist
Before running eas build or expo prebuild:
bash# 1. Confirm nitro-modules version matches iap's peer dep
cat node_modules/react-native-iap/package.json | grep nitro

# 2. Confirm onlyIncludeActiveItemsIOS exists in v14
grep -r "onlyIncludeActiveItemsIOS" node_modules/react-native-iap/src

# 3. Clean install to avoid transitive version conflicts
rm -rf node_modules && npm install

# 4. TypeScript check (you said it passes, but run again after clean install)
npx tsc --noEmit

# 5. iOS pod install
cd ios && pod install
Run those 5 commands and report back what the grep outputs are — that'll confirm whether you're truly ready to build or if there's a hidden version mismatch waiting to blow up on a real device.