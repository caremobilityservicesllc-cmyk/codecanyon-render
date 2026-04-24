import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { format, isToday, isTomorrow, parseISO, isWithinInterval, addMinutes } from 'date-fns';
import { Calendar, Clock, MapPin, CheckCircle2, LogIn, LogOut, ChevronRight, AlertCircle, DollarSign, Car, FileText, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DriverEarningsTracker } from '@/components/driver/DriverEarningsTracker';
import { DriverAssignedBookings } from '@/components/driver/DriverAssignedBookings';
import { DriverDocumentPortal } from '@/components/driver/DriverDocumentPortal';
import { DriverPayoutTracker } from '@/components/driver/DriverPayoutTracker';
import { useDriverRealTimeNotifications } from '@/hooks/useDriverRealTimeNotifications';
import { useLanguage } from '@/contexts/LanguageContext';

interface DriverShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  zone: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface DriverProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string | null;
  average_rating: number | null;
  total_rides: number | null;
  is_available: boolean | null;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('rides');

  const { data: driverProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, phone, avatar_url, average_rating, total_rides, is_available')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as DriverProfile | null;
    },
    enabled: !!user?.id,
  });

  useDriverRealTimeNotifications({
    driverId: driverProfile?.id,
    enabled: !!driverProfile?.id,
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (newStatus: boolean) => {
      if (!driverProfile?.id) throw new Error('No driver profile');
      const { error } = await supabase
        .from('drivers')
        .update({ is_available: newStatus, updated_at: new Date().toISOString() })
        .eq('id', driverProfile.id);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      toast.success(newStatus ? t.driver.availableForRides : t.driver.nowOffline);
    },
    onError: () => {
      toast.error(t.driver.failedToUpdateAvailability);
    },
  });

  const handleAvailabilityToggle = useCallback((checked: boolean) => {
    toggleAvailabilityMutation.mutate(checked);
  }, [toggleAvailabilityMutation]);

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['driver-shifts', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      const { data, error } = await supabase
        .from('driver_shifts')
        .select(`
          id,
          shift_date,
          start_time,
          end_time,
          status,
          notes,
          check_in_at,
          check_out_at,
          zone:zones(id, name, description)
        `)
        .eq('driver_id', driverProfile.id)
        .gte('shift_date', format(new Date(), 'yyyy-MM-dd'))
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as unknown as DriverShift[];
    },
    enabled: !!driverProfile?.id,
  });

  const checkInMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from('driver_shifts')
        .update({
          status: 'active',
          check_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', shiftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-shifts'] });
      toast.success(t.driver.checkedInSuccess);
    },
    onError: () => {
      toast.error(t.driver.failedToCheckIn);
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from('driver_shifts')
        .update({
          status: 'completed',
          check_out_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', shiftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-shifts'] });
      toast.success(t.driver.checkedOutSuccess);
    },
    onError: () => {
      toast.error(t.driver.failedToCheckOut);
    },
  });

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return t.time.today;
    if (isTomorrow(date)) return t.time.tomorrow;
    return format(date, 'EEE, MMM d');
  };

  const getStatusBadge = (shift: DriverShift) => {
    switch (shift.status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{t.status.active}</Badge>;
      case 'completed':
        return <Badge className="bg-muted text-muted-foreground">{t.status.completed}</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">{t.status.cancelled}</Badge>;
      default:
        return <Badge variant="secondary">{t.status.scheduled}</Badge>;
    }
  };

  const canCheckIn = (shift: DriverShift) => {
    if (shift.status !== 'scheduled') return false;
    const now = new Date();
    const shiftDate = parseISO(shift.shift_date);
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const shiftStart = new Date(shiftDate.setHours(startHour, startMin, 0, 0));
    const checkInWindow = addMinutes(shiftStart, -15);
    return now >= checkInWindow && isToday(parseISO(shift.shift_date));
  };

  const canCheckOut = (shift: DriverShift) => {
    return shift.status === 'active';
  };

  const todayShifts = shifts.filter(s => isToday(parseISO(s.shift_date)));
  const upcomingShifts = shifts.filter(s => !isToday(parseISO(s.shift_date)));
  const activeShift = shifts.find(s => s.status === 'active');

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t.auth.signInRequired}</h1>
          <p className="text-muted-foreground">{t.auth.pleaseSignIn}</p>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-pulse">{t.driver.loadingProfile}</div>
        </div>
      </div>
    );
  }

  if (!driverProfile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t.driver.notADriver}</h1>
          <p className="text-muted-foreground">{t.driver.notLinkedToProfile}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-6 max-w-[720px]">
        {/* Driver Profile Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={driverProfile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {driverProfile.first_name[0]}{driverProfile.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-xl font-bold">
                  {driverProfile.first_name} {driverProfile.last_name}
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span>⭐ {driverProfile.average_rating?.toFixed(1) || '5.0'}</span>
                  <span>{driverProfile.total_rides || 0} {t.common.rides}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Switch
                  checked={driverProfile.is_available ?? false}
                  onCheckedChange={handleAvailabilityToggle}
                  disabled={toggleAvailabilityMutation.isPending}
                  className="data-[state=checked]:bg-green-500"
                />
                <span className={cn(
                  "text-xs font-medium",
                  driverProfile.is_available ? "text-green-400" : "text-muted-foreground"
                )}>
                  {driverProfile.is_available ? t.driver.available : t.driver.offline}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Shift Banner */}
        {activeShift && (
          <Card className="mb-6 border-green-500/50 bg-green-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-green-400">{t.driver.currentlyActive}</p>
                  <p className="text-sm text-muted-foreground">
                    {activeShift.zone.name} • {activeShift.start_time.slice(0, 5)} - {activeShift.end_time.slice(0, 5)}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => checkOutMutation.mutate(activeShift.id)}
                disabled={checkOutMutation.isPending}
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {checkOutMutation.isPending ? t.driver.checkingOut : t.driver.checkOut}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Shifts Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-6 mb-4">
            <TabsTrigger value="rides" className="gap-1 text-xs sm:text-sm">
              <Car className="h-4 w-4" />
              <span className="hidden sm:inline">{t.driver.rides}</span>
            </TabsTrigger>
            <TabsTrigger value="today" className="gap-1 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t.driver.today}</span>
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1 text-xs sm:text-sm">
              <ChevronRight className="h-4 w-4" />
              <span className="hidden sm:inline">{t.driver.upcoming}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t.driver.documents}</span>
            </TabsTrigger>
            <TabsTrigger value="earnings" className="gap-1 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">{t.driver.earnings}</span>
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-1 text-xs sm:text-sm">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">{t.driver.payouts}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rides">
            <DriverAssignedBookings driverId={driverProfile.id} />
          </TabsContent>

          <TabsContent value="today" className="space-y-4">
            {shiftsLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t.driver.loadingShifts}
                </CardContent>
              </Card>
            ) : todayShifts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t.driver.noShiftsToday}</p>
                </CardContent>
              </Card>
            ) : (
              todayShifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  canCheckIn={canCheckIn(shift)}
                  canCheckOut={canCheckOut(shift)}
                  onCheckIn={() => checkInMutation.mutate(shift.id)}
                  onCheckOut={() => checkOutMutation.mutate(shift.id)}
                  isCheckingIn={checkInMutation.isPending}
                  isCheckingOut={checkOutMutation.isPending}
                  getStatusBadge={getStatusBadge}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingShifts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t.driver.noUpcomingShifts}</p>
                </CardContent>
              </Card>
            ) : (
              upcomingShifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  canCheckIn={false}
                  canCheckOut={false}
                  onCheckIn={() => {}}
                  onCheckOut={() => {}}
                  isCheckingIn={false}
                  isCheckingOut={false}
                  getStatusBadge={getStatusBadge}
                  showDate
                  getDateLabel={getDateLabel}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="documents">
            <DriverDocumentPortal 
              driverId={driverProfile.id} 
              driverName={`${driverProfile.first_name} ${driverProfile.last_name}`}
            />
          </TabsContent>

          <TabsContent value="earnings">
            <DriverEarningsTracker driverId={driverProfile.id} />
          </TabsContent>

          <TabsContent value="payouts">
            <DriverPayoutTracker driverId={driverProfile.id} />
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

interface ShiftCardProps {
  shift: DriverShift;
  canCheckIn: boolean;
  canCheckOut: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  isCheckingIn: boolean;
  isCheckingOut: boolean;
  getStatusBadge: (shift: DriverShift) => React.ReactNode;
  showDate?: boolean;
  getDateLabel?: (dateStr: string) => string;
}

function ShiftCard({
  shift,
  canCheckIn,
  canCheckOut,
  onCheckIn,
  onCheckOut,
  isCheckingIn,
  isCheckingOut,
  getStatusBadge,
  showDate,
  getDateLabel,
}: ShiftCardProps) {
  const { t } = useLanguage();
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            {showDate && getDateLabel && (
              <p className="text-xs text-muted-foreground mb-1">
                {getDateLabel(shift.shift_date)}
              </p>
            )}
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              {shift.zone.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
            </CardDescription>
          </div>
          {getStatusBadge(shift)}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {shift.notes && (
          <p className="text-sm text-muted-foreground mb-3">{shift.notes}</p>
        )}

        {shift.check_in_at && (
          <p className="text-xs text-muted-foreground mb-2">
            Checked in at {format(new Date(shift.check_in_at), 'h:mm a')}
          </p>
        )}
        {shift.check_out_at && (
          <p className="text-xs text-muted-foreground mb-2">
            Checked out at {format(new Date(shift.check_out_at), 'h:mm a')}
          </p>
        )}

        {canCheckIn && (
          <Button
            onClick={onCheckIn}
            disabled={isCheckingIn}
            className="w-full"
            variant="accent"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {isCheckingIn ? t.driver.checkingIn : t.driver.checkIn}
          </Button>
        )}

        {canCheckOut && (
          <Button
            onClick={onCheckOut}
            disabled={isCheckingOut}
            variant="outline"
            className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isCheckingOut ? t.driver.checkingOut : t.driver.checkOut}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
