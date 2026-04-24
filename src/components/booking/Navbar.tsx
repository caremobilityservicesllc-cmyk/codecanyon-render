import { Clock, Phone, User, LogOut, Shield, Calendar, Settings, CreditCard, Bell, Search, Car, Briefcase } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BecomeDriverDialog } from '@/components/driver/BecomeDriverDialog';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRoles();
  const { t } = useTranslation();
  const { businessInfo, businessHours, appearanceSettings } = useSystemSettings();
  const logoSrc = useBrandLogo();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: isDriver } = useQuery({
    queryKey: ['is-driver', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name.split(' ')[0];
    return user?.email?.split('@')[0];
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoSrc} alt={`${businessInfo.companyName || 'RideFlow'} Logo`} className="h-10 w-10 rounded-xl object-contain" />
            <span className="font-display text-xl font-bold text-foreground">{businessInfo.companyName || 'RideFlow'}</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
              <Clock className="h-4 w-4" />
              <span>
                {businessHours.daysOfWeek && businessHours.daysOfWeek.length > 0 && businessHours.daysOfWeek.length < 7 ? (
                  <>
                    {businessHours.daysOfWeek.length === 5 && 
                     ['monday','tuesday','wednesday','thursday','friday'].every(d => businessHours.daysOfWeek.includes(d))
                      ? 'Mon–Fri'
                      : businessHours.daysOfWeek.length === 6
                        ? `${businessHours.daysOfWeek[0].charAt(0).toUpperCase() + businessHours.daysOfWeek[0].slice(1, 3)}–${businessHours.daysOfWeek[businessHours.daysOfWeek.length - 1].charAt(0).toUpperCase() + businessHours.daysOfWeek[businessHours.daysOfWeek.length - 1].slice(1, 3)}`
                        : businessHours.daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
                    }
                    {' · '}
                  </>
                ) : null}
                {businessHours.start} – {businessHours.end}
              </span>
            </div>

            <div className="hidden items-center gap-2 text-sm font-medium text-foreground md:flex">
              <Phone className="h-4 w-4 text-accent" />
              <span>{businessInfo.phone}</span>
            </div>

            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-2">
                <NotificationBell />
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline max-w-[120px] truncate">{getDisplayName()}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                        <AvatarFallback className="bg-primary text-primary-foreground">{getUserInitials()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-foreground">{profile?.full_name || t.nav.myAccount}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => navigate('/my-bookings')}>
                      <Calendar className="me-2 h-4 w-4" />
                      {t.nav.bookings}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/account')}>
                      <User className="me-2 h-4 w-4" />
                      {t.nav.profile}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/account?tab=notifications')}>
                      <Bell className="me-2 h-4 w-4" />
                      {t.nav.notifications}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/account?tab=payments')}>
                      <CreditCard className="me-2 h-4 w-4" />
                      {t.nav.payments}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/account?tab=settings')}>
                      <Settings className="me-2 h-4 w-4" />
                      {t.nav.settings}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />
                  {isDriver ? (
                    <DropdownMenuItem onClick={() => navigate('/driver')}>
                      <Car className="me-2 h-4 w-4" />
                      {t.nav.driverPortal}
                    </DropdownMenuItem>
                  ) : (
                    <BecomeDriverDialog>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Briefcase className="me-2 h-4 w-4" />
                        {t.nav.becomeDriver}
                      </DropdownMenuItem>
                    </BecomeDriverDialog>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                       <Shield className="me-2 h-4 w-4" />
                      {t.nav.admin}
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="me-2 h-4 w-4" />
                    {t.nav.signOut}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/track')} className="gap-2">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.nav.trackBooking}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                  {t.nav.signIn}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
