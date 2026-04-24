import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Car, 
  Users,
  UserCheck,
  UserPlus,
  Settings, 
  TicketPercent,
  MapPin,
  LogOut,
  ChevronLeft,
  Bell,
  Map,
  Calculator,
  Tag,
  CalendarClock,
  TrendingUp,
  FileCheck,
  FileText,
  PanelLeftClose,
  PanelLeft,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCallback } from 'react';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function SidebarContent({ 
  collapsed, 
  onToggle, 
  onNavigate 
}: { 
  collapsed: boolean; 
  onToggle?: () => void; 
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { businessInfo, appearanceSettings } = useSystemSettings();
  const brandLogo = useBrandLogo();
  const { t, isRTL } = useLanguage();
  const companyName = businessInfo.companyName || 'RideFlow';
  const tooltipSide = isRTL ? 'left' as const : 'right' as const;

  const navItems = [
    { icon: LayoutDashboard, label: t.admin.dashboard, path: '/admin' },
    { icon: Calendar, label: t.admin.bookings, path: '/admin/bookings' },
    { icon: UserCheck, label: t.admin.drivers, path: '/admin/drivers' },
    { icon: UserPlus, label: t.admin.driverApplications, path: '/admin/driver-applications' },
    { icon: FileCheck, label: t.admin.documentReview, path: '/admin/document-review' },
    { icon: Car, label: t.admin.vehicles, path: '/admin/vehicles' },
    { icon: Users, label: t.admin.customers, path: '/admin/customers' },
    { icon: Bell, label: t.admin.notifications, path: '/admin/notifications' },
    { icon: MapPin, label: t.admin.zones, path: '/admin/zones' },
    { icon: Map, label: t.admin.routes, path: '/admin/routes' },
    { icon: TicketPercent, label: t.admin.pricingRules, path: '/admin/pricing' },
    { icon: Tag, label: t.admin.promoCodes, path: '/admin/promo-codes' },
    { icon: Calculator, label: t.admin.priceCalculator, path: '/admin/calculator' },
    { icon: CalendarClock, label: t.admin.scheduling, path: '/admin/scheduling' },
    { icon: TrendingUp, label: t.admin.revenue, path: '/admin/revenue' },
    { icon: FileText, label: t.admin.pages, path: '/admin/pages' },
    { icon: Settings, label: t.admin.settings, path: '/admin/settings' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavClick = () => {
    onNavigate?.();
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header with Toggle */}
      <div className={cn(
        "flex items-center border-b border-border p-4 min-h-[65px]",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <div className="flex items-center gap-2">
          <img src={brandLogo} alt={companyName} className="h-8 w-8 flex-shrink-0 rounded-lg object-contain" />
          {!collapsed && (
            <span className="font-semibold text-foreground whitespace-nowrap">{companyName} Admin</span>
          )}
        </div>
        {!collapsed && onToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expand button when collapsed (desktop only) */}
      {collapsed && onToggle && (
        <div className="flex justify-center py-2 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => (
          <Tooltip key={item.path} delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  'w-full flex items-center rounded-lg text-sm font-medium transition-colors my-1.5',
                  collapsed ? 'justify-center px-3 py-3' : 'justify-start gap-3 px-3 py-3',
                  isActive(item.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side={tooltipSide} className="bg-popover">
                {item.label}
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-1">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full text-muted-foreground hover:text-foreground",
                collapsed ? "justify-center p-2.5" : "justify-start gap-3 px-3"
              )}
              onClick={() => {
                navigate('/');
                handleNavClick();
              }}
            >
              <ChevronLeft className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{t.nav.backToHome}</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side={tooltipSide} className="bg-popover">
              {t.nav.backToHome}
            </TooltipContent>
          )}
        </Tooltip>
        
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full text-muted-foreground hover:text-destructive",
                collapsed ? "justify-center p-2.5" : "justify-start gap-3 px-3"
              )}
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{t.nav.signOut}</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side={tooltipSide} className="bg-popover">
              {t.nav.signOut}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { businessInfo, appearanceSettings } = useSystemSettings();
  const brandLogo = useBrandLogo();
  const { isRTL } = useLanguage();
  
  const sidePosition = isRTL ? 'right' : 'left';

  return (
    <>
      {/* Mobile Sticky Header (< md) */}
      <header className="fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <div className="flex items-center gap-2">
          <img src={brandLogo} alt={businessInfo.companyName || 'RideFlow'} className="h-8 w-8 flex-shrink-0 rounded-lg object-contain" />
          <span className="font-semibold text-foreground">{businessInfo.companyName || 'RideFlow'} Admin</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={sidePosition} className="w-64 p-0 bg-card">
            <SidebarContent 
              collapsed={false} 
              onNavigate={() => setMobileOpen(false)} 
            />
          </SheetContent>
        </Sheet>
      </header>

      {/* Tablet Mini Sidebar (md to lg) - Always collapsed */}
      <aside 
        className={cn(
          "fixed top-0 z-40 h-screen w-16 bg-card hidden md:block lg:hidden",
          "inset-inline-start-0 border-ie"
        )}
        style={{ borderInlineEnd: '1px solid hsl(var(--border))' }}
      >
        <SidebarContent 
          collapsed={true} 
        />
      </aside>

      {/* Desktop Collapsible Sidebar (lg+) - Toggle between mini and full */}
      <aside 
        className={cn(
          "fixed top-0 z-40 h-screen bg-card transition-all duration-300",
          "hidden lg:block",
          collapsed ? "w-16" : "w-64"
        )}
        style={{ 
          insetInlineStart: 0, 
          borderInlineEnd: '1px solid hsl(var(--border))' 
        }}
      >
        <SidebarContent 
          collapsed={collapsed} 
          onToggle={onToggle} 
        />
      </aside>
    </>
  );
}
