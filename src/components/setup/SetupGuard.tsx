import { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSetupCheck } from '@/hooks/useSetupCheck';
import { LoadingScreen } from '@/components/LoadingScreen';

interface SetupGuardProps {
  children?: ReactNode;
}

function renderGuardContent(children?: ReactNode) {
  return children ? <>{children}</> : <Outlet />;
}

export function RequireSetupComplete({ children }: SetupGuardProps) {
  const { isLoading, isSetupComplete, error } = useSetupCheck();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return renderGuardContent(children);
  }

  if (!isSetupComplete) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/setup?next=${encodeURIComponent(next)}`} replace />;
  }

  return renderGuardContent(children);
}

export function SetupOnlyRoute({ children }: SetupGuardProps) {
  const { isLoading, isSetupComplete, error } = useSetupCheck();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return renderGuardContent(children);
  }

  if (isSetupComplete) {
    return <Navigate to="/" replace />;
  }

  return renderGuardContent(children);
}

export function SetupGuard({ children }: { children: ReactNode }) {
  return <RequireSetupComplete>{children}</RequireSetupComplete>;
}

