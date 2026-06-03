import { useState, useCallback } from 'react';
import type { Plan } from '../background/orchestrator.js';

interface UsePlanResult {
  plan: Plan | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePlan(): UsePlanResult {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);

    // Guard: chrome may not be defined in test/non-extension environments
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      setLoading(false);
      setError('Chrome runtime not available');
      return;
    }

    chrome.runtime.sendMessage(
      { kind: 'build-plan' },
      (response: Plan | undefined) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message ?? 'Unknown error');
          return;
        }
        if (response) {
          setPlan(response);
        } else {
          setError('No response from background');
        }
      }
    );
  }, []);

  return { plan, loading, error, refresh };
}
