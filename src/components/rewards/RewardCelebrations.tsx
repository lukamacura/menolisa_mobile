import React from 'react';
import { useRewards } from '../../context/RewardsContext';
import { CelebrationModal } from './CelebrationModal';

/**
 * Renders whatever celebration is at the head of the queue, wherever she is.
 *
 * Mounted once beside the tab navigator rather than per screen: a badge earned
 * by ticking a nutrition row should land on the nutrition screen, and the tick
 * that earns it is rarely on the screen that owns rewards.
 */
export function RewardCelebrations() {
  const { celebration, dismissCelebration } = useRewards();
  return <CelebrationModal celebration={celebration} onDismiss={dismissCelebration} />;
}
