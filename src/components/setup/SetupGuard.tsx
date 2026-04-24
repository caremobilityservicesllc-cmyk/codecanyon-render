import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSetupCheck } from '@/hooks/useSetupCheck';
import { LoadingScreen } from '@/components/LoadingScreen';

interface SetupGuardProps {
  children: ReactNode;
}

export function SetupGuard({ children }: SetupGuardProps) {
  const { isLoading, isSetupComplete, error } = useSetupCheck();
  const location = useLocation();
  const publicPaths = new Set([
    '/',
    '/auth',
    '/book-now',
    '/contact',
    '/features',
    '/terms',
    '/privacy',
    '/install',
    '/track',
    '/driver/login',
  ]);
  const isPublicPath = publicPaths.has(location.pathname) || location.pathname.startsWith('/page/');

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Avoid false redirect loops when setup check is temporarily unavailable.
  if (error) {
    return <>{children}</>;
  }

  // If setup is NOT complete and user is NOT on /setup, redirect to /setup.
  // Preserve auth callback params/hash so email verification can complete.
  if (!isSetupComplete && location.pathname !== '/setup' && !isPublicPath) {
    return <Navigate to={`/setup${location.search}${location.hash}`} replace />;
  }

  // If setup IS complete and user is on /setup, redirect to home.
  if (isSetupComplete && location.pathname === '/setup') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

