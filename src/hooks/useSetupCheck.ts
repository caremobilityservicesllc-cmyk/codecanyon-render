import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SetupStatus {
  isLoading: boolean;
  isSetupComplete: boolean;
  error: string | null;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800;
const SETUP_COMPLETED_OVERRIDE_KEY = 'rideflow-setup-completed';

function readSetupCompletedOverride(): boolean {
  try {
    return localStorage.getItem(SETUP_COMPLETED_OVERRIDE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeSetupCompletedOverride(value: boolean) {
  try {
    if (value) {
      localStorage.setItem(SETUP_COMPLETED_OVERRIDE_KEY, 'true');
      return;
    }

    localStorage.removeItem(SETUP_COMPLETED_OVERRIDE_KEY);
  } catch {
    // Ignore localStorage failures in compatibility mode.
  }
}

function isSetupCompletedValue(value: unknown): boolean {
  if (value === true || value === 'true') return true;

  if (typeof value === 'object' && value !== null && 'completed' in value) {
    return (value as { completed?: unknown }).completed === true;
  }

  return false;
}

export function useSetupCheck(): SetupStatus {
  const hasLocalOverride = readSetupCompletedOverride();
  const [status, setStatus] = useState<SetupStatus>({
    isLoading: !hasLocalOverride,
    isSetupComplete: hasLocalOverride,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const checkSetupStatus = async (retryCount = 0) => {
      try {
        const { data: setupSetting, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'setup_completed')
          .maybeSingle();

        if (error) throw error;

        if (cancelled) return;

        const isSetupComplete = isSetupCompletedValue(setupSetting?.value);
        writeSetupCompletedOverride(isSetupComplete);

        setStatus({
          isLoading: false,
          isSetupComplete,
          error: null,
        });
      } catch {
        if (cancelled) return;

        if (retryCount < MAX_RETRIES) {
          retryTimeout = setTimeout(() => {
            void checkSetupStatus(retryCount + 1);
          }, RETRY_DELAY_MS * (retryCount + 1));
          return;
        }

        setStatus({
          isLoading: false,
          isSetupComplete: readSetupCompletedOverride(),
          error: readSetupCompletedOverride() ? null : 'Failed to check setup status',
        });
      }
    };

    void checkSetupStatus();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  return status;
}

