import { ReactNode, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdminSidebar } from './AdminSidebar';
import { ActiveRidesCounter } from './ActiveRidesCounter';
import { TodayBookingsCounter } from './TodayBookingsCounter';
import { TodayRevenueCounter } from './TodayRevenueCounter';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const { isRTL } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (authLoading || rolesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Use margin-inline-start for automatic RTL support
  const marginClass = cn(
    "ms-0 pt-16 md:pt-6 md:ms-16",
    sidebarCollapsed ? "lg:ms-16" : "lg:ms-64"
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <main 
        className={cn(
          "min-h-screen p-6 transition-all duration-300",
          marginClass
        )}
      >
        {/* Top bar with active rides counter */}
        <div className="flex items-center justify-between mb-6">
          <div>
            {title && <h1 className="text-3xl font-bold text-foreground">{title}</h1>}
            {description && <p className="text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <TodayBookingsCounter />
            <TodayRevenueCounter />
            <ActiveRidesCounter />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
