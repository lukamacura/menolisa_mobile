import { useCallback, useEffect, useState } from 'react';
import { apiFetchWithAuth, API_CONFIG } from '../lib/api';

type SymptomLogRow = { logged_at?: string };

/**
 * How many symptoms she has logged since local midnight.
 *
 * `null` while it is still unknown — a failed fetch must not render "0 logged
 * today", which reads as a fact about her day rather than about the network.
 *
 * The server returns the last 24h, not the calendar day, so the cut to today is
 * made here against her device clock. Same rule the Symptoms screen uses.
 */
export function useSymptomsToday() {
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetchWithAuth(`${API_CONFIG.endpoints.symptomLogs}?days=1`);
      const logs: SymptomLogRow[] = res?.data ?? [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      setCount(
        logs.filter((log) => log.logged_at && new Date(log.logged_at) >= todayStart).length
      );
    } catch {
      setCount(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, refresh };
}
