import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Opening decelerates into place; closing accelerates away, so the sheet reads
// as leaving rather than being deleted.
const OPEN = { duration: 340, easing: Easing.bezier(0.16, 1, 0.3, 1) };
const CLOSE = { duration: 240, easing: Easing.bezier(0.4, 0, 0.9, 0.4) };

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Fired once the exit animation has finished and the modal is unmounted. */
  onClosed?: () => void;
  /** Padding, max height and surface colour belong to the caller. */
  sheetStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

/**
 * The slide-up surface every "why is this here" sheet sits on.
 *
 * `Modal`'s own `animationType="slide"` moves the dim backdrop along with the
 * sheet, which reads as the whole screen sliding off rather than a sheet
 * closing over a screen that stayed put. Driving the two separately — backdrop
 * fades, sheet travels — is the whole reason this exists, and it keeps the
 * modal mounted long enough for the exit to actually play.
 */
export function BottomSheetModal({
  visible,
  onClose,
  onClosed,
  sheetStyle,
  backdropColor = 'rgba(31, 27, 45, 0.5)',
  accessibilityLabel = 'Close',
  children,
}: BottomSheetModalProps) {
  const [mounted, setMounted] = useState(visible);

  const progress = useSharedValue(0);
  // Travel distance, so the sheet starts exactly one sheet-height below its
  // resting place rather than an arbitrary guess.
  const sheetHeight = useSharedValue(0);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClosed?.();
  }, [onClosed]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Reopened before the exit finished — the travel is already known, so
      // run the open now. On a first open, onLayout starts it instead.
      if (sheetHeight.value > 0) progress.value = withTiming(1, OPEN);
      return;
    }
    if (!mounted) return;
    if (sheetHeight.value === 0) {
      // Never measured — nothing on screen to animate out.
      finishClose();
      return;
    }
    progress.value = withTiming(0, CLOSE, (finished) => {
      'worklet';
      if (!finished) return;
      sheetHeight.value = 0;
      runOnJS(finishClose)();
    });
  }, [visible, mounted, finishClose, progress, sheetHeight]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height <= 0 || sheetHeight.value !== 0) return;
      sheetHeight.value = height;
      progress.value = withTiming(1, OPEN);
    },
    [progress, sheetHeight],
  );

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const surfaceStyle = useAnimatedStyle(() => ({
    // Before the first measure the sheet sits a full height down and so is off
    // screen, which is also where the close animation lands it.
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <AnimatedPressable
        style={[styles.backdrop, { backgroundColor: backdropColor }, backdropStyle]}
        onPress={onClose}
        accessibilityLabel={accessibilityLabel}
      >
        {/* Stops a tap inside the sheet from closing it. */}
        <AnimatedPressable
          style={[styles.sheet, sheetStyle, surfaceStyle]}
          onPress={() => {}}
          onLayout={handleLayout}
        >
          {children}
        </AnimatedPressable>
      </AnimatedPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
});
