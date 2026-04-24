import { ReactNode, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';

interface GuardProps {
  children?: ReactNode;
}

function renderGuardContent(children?: ReactNode) {
  return children ? <>{children}</> : <Outlet />;
}

function useDriverProfileState(userId?: string) {
  const [state, setState] = useState({ loading: !!userId, hasDriverProfile: false });

  useEffect(() => {
    let cancelled = false;

    async function resolveDriverProfile() {
      if (!userId) {
        setState({ loading: false, hasDriverProfile: false });
        return;
      }

      setState((current) => ({ ...current, loading: true }));

      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      setState({
        loading: false,
        hasDriverProfile: !error && !!data,
      });
    }

    resolveDriverProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}

export function RequireAuthenticated({ children }: GuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  return renderGuardContent(children);
}

export function RequireAdmin({ children }: GuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();

  if (authLoading || rolesLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth?redirect=%2Fadmin" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return renderGuardContent(children);
}

export function RequireDriver({ children }: GuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasDriverProfile, loading: driverLoading } = useDriverProfileState(user?.id);

  if (authLoading || driverLoading) {
    return <LoadingScreen />;
  }

  if (!user || !hasDriverProfile) {
    return <Navigate to="/driver/login" replace />;
  }

  return renderGuardContent(children);
}

export function AuthEntryRoute({ children }: GuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const { hasDriverProfile, loading: driverLoading } = useDriverProfileState(user?.id);

  if (authLoading || (user && (rolesLoading || driverLoading))) {
    return <LoadingScreen />;
  }

  if (!user) {
    return renderGuardContent(children);
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (hasDriverProfile) {
    return <Navigate to="/driver" replace />;
  }

  return <Navigate to="/" replace />;
}

export function DriverEntryRoute({ children }: GuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasDriverProfile, loading: driverLoading } = useDriverProfileState(user?.id);

  if (authLoading || (user && driverLoading)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return renderGuardContent(children);
  }

  if (hasDriverProfile) {
    return <Navigate to="/driver" replace />;
  }

  return renderGuardContent(children);
}