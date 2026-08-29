import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * The app's haptic vocabulary.
 *
 * Three call sites had grown their own `Haptics.impactAsync(...).catch(() => {})`
 * while the controls she actually touches all day — the tick boxes, the severity
 * scale — had none at all. A checkbox that changes colour and does nothing else
 * is the difference between an app that feels made and one that feels drawn.
 *
 * Named by *meaning*, not by strength, so the physical language stays consistent
 * as screens get added: everything that confirms a small action feels the same
 * everywhere, and only finishing something is allowed to feel bigger.
 *
 * Every call is fire-and-forget. The taptic engine is unavailable on web, on
 * older Android hardware, and while the phone is in certain low-power states;
 * none of those are worth an unhandled rejection, and none of them should ever
 * stop the state change the haptic accompanies.
 */

/** Web has no haptics API; calling through would throw on every tap. */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function impact(style: Haptics.ImpactFeedbackStyle) {
  if (!enabled) return;
  Haptics.impactAsync(style).catch(() => {});
}

function notify(type: Haptics.NotificationFeedbackType) {
  if (!enabled) return;
  Haptics.notificationAsync(type).catch(() => {});
}

export const haptics = {
  /**
   * Moving through a set of choices — a severity, a tab, a week, a filter.
   * The lightest thing the engine can do, because she may cross five of these
   * on the way to the one she wants.
   */
  select() {
    if (!enabled) return;
    Haptics.selectionAsync().catch(() => {});
  },

  /** A button did the thing it said it would. */
  press() {
    impact(Haptics.ImpactFeedbackStyle.Light);
  },

  /** One unit logged: a glass of water, a pip, a box ticked on. */
  tick() {
    impact(Haptics.ImpactFeedbackStyle.Light);
  },

  /**
   * Taking one back.
   *
   * Deliberately softer than `tick`. Undoing a mistap should not feel like the
   * same event as logging something — she should be able to tell, without
   * looking, that the count went the other way.
   */
  untick() {
    impact(Haptics.ImpactFeedbackStyle.Soft);
  },

  /**
   * A task is finished — the target met, the session done, the habit held.
   *
   * The one moment in the daily loop worth a full notification-grade buzz. It
   * fires rarely by design: if everything celebrates, nothing does.
   */
  complete() {
    notify(Haptics.NotificationFeedbackType.Success);
  },

  /** Something bigger than a task landed: a badge, a level, eight weeks closed. */
  celebrate() {
    impact(Haptics.ImpactFeedbackStyle.Medium);
  },

  /** A warning she should feel before she reads it. */
  warn() {
    notify(Haptics.NotificationFeedbackType.Warning);
  },

  /** It failed. */
  error() {
    notify(Haptics.NotificationFeedbackType.Error);
  },
};
