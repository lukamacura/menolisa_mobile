import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Checks whether today's mood has been logged and provides a submit function.
 *
 * Reads from / writes to the `daily_mood` table:
 *   daily_mood(id uuid PK, user_id uuid, date date, mood integer, created_at timestamptz)
 *
 * mood values: 1=Rough  2=Okay  3=Good  4=Great
 *
 * The upsert uses the unique constraint on (user_id, date) so re-submitting the same
 * day overwrites the previous value rather than creating a duplicate row.
 */
export function useDailyMood() {
  const { user } = useAuth();
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Stable date string — recalculated on each render but only changes at midnight,
  // which is fine because checkTodayMood is only called on mount / explicit refresh.
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  const checkTodayMood = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('daily_mood')
        .select('mood')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      setTodayMood(data?.mood ?? null);
    } catch {
      setTodayMood(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, today]);

  useEffect(() => {
    checkTodayMood();
  }, [checkTodayMood]);

  /**
   * Upsert today's mood for the current user.
   * Returns true on success, false on failure.
   */
  const submitMood = useCallback(async (mood: 1 | 2 | 3 | 4): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const { error } = await supabase
        .from('daily_mood')
        .upsert(
          { user_id: user.id, date: today, mood },
          { onConflict: 'user_id,date' }
        );
      if (!error) {
        setTodayMood(mood);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [user?.id, today]);

  return {
    /** The mood value logged today (1–4), or null if no entry exists yet. */
    todayMood,
    /** True while the initial check is in flight. */
    loading,
    /** Convenience boolean — true when todayMood is not null. */
    hasMoodToday: todayMood !== null,
    /** Submit (or update) today's mood entry. */
    submitMood,
  };
}
