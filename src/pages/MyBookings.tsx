import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { 
  Calendar, Clock, MapPin, Car, ArrowLeft, RotateCcw, RefreshCw, ArrowRight, 
  Users, Share2, Check, X, CalendarClock, Search, Filter, List, CalendarDays,
  Download, ExternalLink, Bell, AlertCircle, MessageSquare, Loader2, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { ShareRideDialog } from '@/components/booking/ShareRideDialog';
import { AcceptShareConfirmDialog } from '@/components/booking/AcceptShareConfirmDialog';
import { RecurringBookingDialog } from '@/components/booking/RecurringBookingDialog';
import { RecurringBookingsList } from '@/components/booking/RecurringBookingsList';
import { BookingCard } from '@/components/booking/BookingCard';
import { BookingsCalendarView } from '@/components/booking/BookingsCalendarView';
import { SharedRidesHistory } from '@/components/booking/SharedRidesHistory';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { TransferType } from '@/types/booking';
import { useRideSharing } from '@/hooks/useRideSharing';
import { useRecurringBookings } from '@/hooks/useRecurringBookings';
import { useNotifications } from '@/hooks/useNotifications';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/admin/TablePagination';
import { toast } from 'sonner';
import { generateICalEvents, downloadICalFile } from '@/utils/calendarExport';

interface Booking {
  id: string;
  booking_reference: string;
  service_type: string;
  transfer_type: TransferType;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  passengers: number;
  vehicle_name: string;
  status: string;
  created_at: string;
  total_price: number;
  payment_method?: string;
  notes?: string;
}

interface SharedRideWithBooking {
  id: string;
  booking_id: string;
  shared_by_user_id: string;
  shared_with_email: string;
  share_token: string;
  cost_split_percentage: number;
  is_accepted: boolean;
  accepted_at: string | null;
  created_at: string;
  booking?: Booking;
  sharer_email?: string;
  proposed_cost_split_percentage?: number | null;
  proposed_at?: string | null;
  proposed_by_user_id?: string | null;
  counter_proposal_accepted_at?: string | null;
}

function useTransferTypeLabels() {
  const { t } = useLanguage();
  const tl = (t as any).transferTypeLabels || {};
  return {
    'one-way': { label: tl.oneWay || 'One Way', icon: <ArrowRight className="h-3 w-3" /> },
    'return': { label: tl.return || 'Return', icon: <RotateCcw className="h-3 w-3" /> },
    'return-new-ride': { label: tl.returnNew || 'Return (New)', icon: <RefreshCw className="h-3 w-3" /> },
  } as Record<TransferType, { label: string; icon: React.ReactNode }>;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  confirmed: 'bg-accent/20 text-accent',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-destructive/20 text-destructive',
};

export default function MyBookings() {
  const { user, loading } = useAuth();
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const transferTypeLabels = useTransferTypeLabels();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sharedRides, setSharedRides] = useState<SharedRideWithBooking[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeTab, setActiveTab] = useState<string>('bookings');
  const [showSharedRidesOnly, setShowSharedRidesOnly] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedShareForAccept, setSelectedShareForAccept] = useState<SharedRideWithBooking | null>(null);
  const { receivedShares, createdShares, acceptShare, declineShare, acceptCounterProposal } = useRideSharing();
  const { recurringBookings } = useRecurringBookings();
  const { unreadCount } = useNotifications();
  const normalizedUserEmail = user?.email?.trim().toLowerCase() || '';

  // Server-side pagination
  const pagination = useServerPagination({ defaultPageSize: 10 });

  // All bookings for counts (lightweight query)
  const [allBookings, setAllBookings] = useState<Booking[]>([]);

  // Query for completed shared rides history
  const { data: completedSharedRides = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['completed-shared-rides', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Fetch all accepted shares where user is either sharer or recipient
      const { data: shares, error: sharesError } = await supabase
        .from('ride_shares')
        .select('*')
        .eq('is_accepted', true);

      if (sharesError) throw sharesError;
      if (!shares || shares.length === 0) return [];

      // Filter to shares involving current user
      const userShares = shares.filter(
        s => s.shared_by_user_id === user.id || s.shared_with_user_id === user.id || s.shared_with_email === user.email
      );

      if (userShares.length === 0) return [];

      // Get bookings for these shares
      const bookingIds = [...new Set(userShares.map(s => s.booking_id))];
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .in('id', bookingIds)
        .eq('status', 'completed');

      if (bookingsError) throw bookingsError;
      if (!bookingsData || bookingsData.length === 0) return [];

      // Get partner profiles
      const partnerIds = [...new Set(userShares.flatMap(s => 
        s.shared_by_user_id === user.id ? [s.shared_with_user_id] : [s.shared_by_user_id]
      ).filter(Boolean))] as string[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', partnerIds);

      const profileMap = new Map(
        profiles?.map(p => [p.id, p.full_name || p.email || 'Unknown']) || []
      );

      // Map to completed shared rides
      return userShares
        .map(share => {
          const booking = bookingsData.find(b => b.id === share.booking_id);
          if (!booking) return null;

          const isSharer = share.shared_by_user_id === user.id;
          const partnerId = isSharer ? share.shared_with_user_id : share.shared_by_user_id;
          const partnerName = partnerId ? profileMap.get(partnerId) : share.shared_with_email;

          return {
            id: share.id,
            booking_id: share.booking_id,
            booking_reference: booking.booking_reference,
            pickup_location: booking.pickup_location,
            dropoff_location: booking.dropoff_location,
            pickup_date: booking.pickup_date,
            pickup_time: booking.pickup_time,
            vehicle_name: booking.vehicle_name,
            total_price: Number(booking.total_price) || 0,
            cost_split_percentage: Number(share.cost_split_percentage) || 50,
            accepted_at: share.accepted_at || share.created_at,
            ride_completed_at: booking.ride_completed_at || booking.pickup_date,
            is_sharer: isSharer,
            partner_name: partnerName || 'Unknown',
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b!.ride_completed_at).getTime() - new Date(a!.ride_completed_at).getTime());
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    // Build query with server-side filtering
    let query = supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .or(`user_id.eq.${user.id},contact_email.eq.${normalizedUserEmail}`);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as 'pending' | 'confirmed' | 'completed' | 'cancelled');
    }

    if (searchQuery) {
      query = query.or(
        `booking_reference.ilike.%${searchQuery}%,pickup_location.ilike.%${searchQuery}%,dropoff_location.ilike.%${searchQuery}%,vehicle_name.ilike.%${searchQuery}%`
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(pagination.rangeFrom, pagination.rangeTo);

    if (!error && data) {
      setBookings(data as Booking[]);
      pagination.setTotalCount(count ?? 0);
    }
    setIsLoading(false);
  }, [user, normalizedUserEmail, statusFilter, searchQuery, pagination.rangeFrom, pagination.rangeTo]);

  // Fetch all bookings for status counts (lightweight - just status field)
  const fetchStatusCounts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select('status')
      .or(`user_id.eq.${user.id},contact_email.eq.${normalizedUserEmail}`);
    if (data) setAllBookings(data as Booking[]);
  }, [user, normalizedUserEmail]);

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchStatusCounts();
      
      // Fetch vehicles for recurring bookings
      supabase
        .from('vehicles')
        .select('id, name')
        .eq('is_active', true)
        .then(({ data }) => {
          if (data) setVehicles(data);
        });
    }
  }, [user, fetchBookings, fetchStatusCounts]);

  // Fetch shared rides with booking details
  useEffect(() => {
    async function fetchSharedRidesWithDetails() {
      if (!receivedShares || receivedShares.length === 0) {
        setSharedRides([]);
        setIsLoadingShared(false);
        return;
      }

      const bookingIds = receivedShares.map(share => share.booking_id);
      
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .in('id', bookingIds);

      if (bookingsError) {
        console.error('Error fetching shared bookings:', bookingsError);
        setIsLoadingShared(false);
        return;
      }

      // Get sharer details from profiles
      const sharerIds = receivedShares.map(share => share.shared_by_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', sharerIds);

      const profileMap = new Map(
        profiles?.map(p => [p.id, p.full_name || p.email || 'Unknown']) || []
      );

      const enrichedShares: SharedRideWithBooking[] = receivedShares.map(share => ({
        ...share,
        booking: bookingsData?.find(b => b.id === share.booking_id) as Booking | undefined,
        sharer_email: profileMap.get(share.shared_by_user_id) || share.shared_with_email || 'Unknown'
      }));

      setSharedRides(enrichedShares);
      setIsLoadingShared(false);
    }

    fetchSharedRidesWithDetails();
  }, [receivedShares]);

  // Reset page when filters change
  useEffect(() => {
    pagination.resetPage();
  }, [statusFilter, searchQuery]);

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    return {
      all: allBookings.length,
      pending: allBookings.filter(b => b.status === 'pending').length,
      confirmed: allBookings.filter(b => b.status === 'confirmed').length,
      completed: allBookings.filter(b => b.status === 'completed').length,
      cancelled: allBookings.filter(b => b.status === 'cancelled').length,
    };
  }, [allBookings]);

  // Pending actions count - share invitations not yet accepted
  const pendingShareInvitations = useMemo(() => {
    return sharedRides.filter(share => !share.is_accepted).length;
  }, [sharedRides]);

  // Counter-proposals pending (shares I created that have proposals)
  const pendingCounterProposals = useMemo(() => {
    return createdShares.filter(share => 
      share.proposed_cost_split_percentage !== null && 
      share.proposed_cost_split_percentage !== undefined &&
      !share.is_accepted
    );
  }, [createdShares]);

  // Shares where my counter-proposal was accepted (ready for me to accept)
  const acceptedProposals = useMemo(() => {
    return sharedRides.filter(share => 
      share.counter_proposal_accepted_at !== null && 
      share.counter_proposal_accepted_at !== undefined &&
      !share.is_accepted
    );
  }, [sharedRides]);

  // Total pending actions
  const totalPendingActions = useMemo(() => {
    return statusCounts.pending + pendingShareInvitations + unreadCount + pendingCounterProposals.length + acceptedProposals.length;
  }, [statusCounts.pending, pendingShareInvitations, unreadCount, pendingCounterProposals.length, acceptedProposals.length]);

  const openAcceptDialog = (share: SharedRideWithBooking) => {
    setSelectedShareForAccept(share);
    setAcceptDialogOpen(true);
  };

  const handleConfirmAccept = async () => {
    if (!selectedShareForAccept) return;
    try {
      await acceptShare.mutateAsync(selectedShareForAccept.share_token);
      setAcceptDialogOpen(false);
      setSelectedShareForAccept(null);
    } catch (error) {
      console.error('Error accepting share:', error);
    }
  };

  const handleAcceptShare = async (shareToken: string) => {
    try {
      await acceptShare.mutateAsync(shareToken);
    } catch (error) {
      console.error('Error accepting share:', error);
    }
  };

  const handleDeclineShare = async (shareId: string) => {
    try {
      await declineShare.mutateAsync(shareId);
    } catch (error) {
      console.error('Error declining share:', error);
    }
  };

  const handleAcceptCounterProposal = async (shareId: string) => {
    try {
      await acceptCounterProposal.mutateAsync(shareId);
    } catch (error) {
      console.error('Error accepting counter-proposal:', error);
    }
  };

  const handleRebook = (booking: Booking) => {
    // Navigate to home with booking data in state for rebooking
    navigate('/', { 
      state: { 
        rebook: {
          pickup: booking.pickup_location,
          dropoff: booking.dropoff_location,
          passengers: booking.passengers,
          vehicleName: booking.vehicle_name,
          transferType: booking.transfer_type,
        }
      }
    });
    toast.success(t.myBookingsMisc.detailsLoaded);
  };

  const handleReschedule = async (bookingId: string, newDate: string, newTime: string) => {
    // Find the booking to get previous details
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) throw new Error('Booking not found');
    
    const previousDate = booking.pickup_date;
    const previousTime = booking.pickup_time;

    const { error } = await supabase
      .from('bookings')
      .update({ pickup_date: newDate, pickup_time: newTime })
      .eq('id', bookingId);

    if (error) {
      throw error;
    }

    // Send reschedule email notification
    try {
      const notificationEmail = (booking.contact_email || normalizedUserEmail).trim().toLowerCase();

      if (notificationEmail) {
        await supabase.functions.invoke('send-booking-email', {
          body: {
            type: 'rescheduled',
            email: notificationEmail,
            bookingReference: booking.booking_reference,
            pickupLocation: booking.pickup_location,
            dropoffLocation: booking.dropoff_location,
            pickupDate: newDate,
            pickupTime: newTime,
            vehicleName: booking.vehicle_name,
            passengers: booking.passengers,
            previousDate,
            previousTime,
          },
        });
      }
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
      // Don't throw - the reschedule was successful, email is secondary
    }

    // Refresh bookings after reschedule
    await fetchBookings();
    await fetchStatusCounts();
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 w-fit">
            <ArrowLeft className="h-4 w-4" />
            {t.common.back}
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl md:text-3xl">
                {t.myBookings.title}
              </h1>
              {totalPendingActions > 0 && (
                <Badge variant="destructive" className="animate-pulse whitespace-nowrap">
                  {totalPendingActions} {t.common.pending}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground sm:text-base">{t.myBookings.subtitle}</p>
          </div>
        </div>

        {/* Pending Actions Summary */}
        {totalPendingActions > 0 && (
          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="h-5 w-5 text-accent" />
                <span className="font-medium text-foreground">{t.myBookings.pendingActions}</span>
                <span className="text-xs text-muted-foreground">{t.myBookings.clickToFilter}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {statusCounts.pending > 0 && (
                  <button
                    onClick={() => {
                      setActiveTab('bookings');
                      setStatusFilter('pending');
                      setShowSharedRidesOnly(false);
                    }}
                    className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-accent/10 transition-colors text-left group"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground group-hover:text-accent" />
                    <span className="text-muted-foreground group-hover:text-foreground">
                      <span className="font-semibold text-foreground">{statusCounts.pending}</span> {t.myBookings.awaitingConfirmation}
                    </span>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 text-accent" />
                  </button>
                )}
                {pendingShareInvitations > 0 && (
                  <div className="flex flex-col gap-2 p-2 rounded-md bg-accent/5 border border-accent/20">
                    <button
                      onClick={() => {
                        setActiveTab('bookings');
                        setShowSharedRidesOnly(true);
                        setStatusFilter('all');
                      }}
                      className="flex items-center gap-2 text-sm hover:bg-accent/10 transition-colors text-left group rounded p-1 -m-1"
                    >
                      <Share2 className="h-4 w-4 text-muted-foreground group-hover:text-accent" />
                      <span className="text-muted-foreground group-hover:text-foreground">
                        <span className="font-semibold text-foreground">{pendingShareInvitations}</span> {t.myBookings.rideShareInvitations}
                      </span>
                    </button>
                    {/* Quick action buttons for all pending invitations */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-accent/10 max-h-48 overflow-y-auto">
                      {sharedRides.filter(s => !s.is_accepted).map((pendingShare) => (
                        <div key={pendingShare.id} className="flex flex-col gap-2 p-2 rounded bg-background/50 sm:flex-row sm:items-center">
                          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                            From: {pendingShare.sharer_email}
                          </span>
                          <div className="flex gap-2 shrink-0">
                      <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-accent/50 text-accent hover:bg-accent/10 flex-1 sm:flex-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAcceptDialog(pendingShare);
                              }}
                            >
                              <Check className="h-3 w-3" />
                              {t.myBookings.accept}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-destructive/50 text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeclineShare(pendingShare.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                              {t.myBookings.decline}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pendingCounterProposals.length > 0 && (
                  <div className="flex flex-col gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        <span className="font-semibold text-foreground">{pendingCounterProposals.length}</span> {t.myBookings.counterProposals}
                      </span>
                    </div>
                    {/* Quick action buttons for counter-proposals */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-primary/10 max-h-48 overflow-y-auto">
                      {pendingCounterProposals.map((proposal) => (
                        <div key={proposal.id} className="flex items-center gap-2 p-1.5 rounded bg-background/50">
                          <span className="text-xs text-muted-foreground truncate flex-1">
                            {proposal.shared_with_email}: {proposal.proposed_cost_split_percentage}%
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-primary/50 text-primary hover:bg-primary/10"
                            onClick={() => handleAcceptCounterProposal(proposal.id)}
                            disabled={acceptCounterProposal.isPending}
                          >
                            {acceptCounterProposal.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            {t.myBookings.accept}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {acceptedProposals.length > 0 && (
                  <div className="flex flex-col gap-2 p-2 rounded-md bg-accent/10 border-2 border-accent animate-pulse-subtle">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-accent" />
                      <span className="text-muted-foreground">
                        <span className="font-semibold text-accent">{acceptedProposals.length}</span> {t.myBookings.proposalsAccepted}
                      </span>
                    </div>
                    {/* Quick action buttons for accepted proposals */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-accent/20 max-h-48 overflow-y-auto">
                      {acceptedProposals.map((share) => (
                        <div key={share.id} className="flex items-center gap-2 p-2 rounded bg-background/80 border border-accent/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {share.sharer_email} accepted your {share.cost_split_percentage}% split!
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {share.booking?.booking_reference || 'Ride share ready'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="h-8 text-xs gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAcceptDialog(share);
                            }}
                          >
                            <Check className="h-3 w-3" />
                            {t.myBookings.acceptNow}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      // Scroll to top where notification bell is and toast a hint
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      toast.info(t.myBookingsMisc.bellHint);
                    }}
                    className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-accent/10 transition-colors text-left group"
                  >
                    <Bell className="h-4 w-4 text-muted-foreground group-hover:text-accent" />
                    <span className="text-muted-foreground group-hover:text-foreground">
                      <span className="font-semibold text-foreground">{unreadCount}</span> {t.myBookings.unreadNotifications}
                    </span>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 text-accent" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setShowSharedRidesOnly(false); }} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="bookings" className="gap-2">
              <Car className="h-4 w-4" />
              {t.myBookings.myRides}
              {bookings.length > 0 && (
                <Badge variant="secondary" className="ml-1">{bookings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              {t.myBookings.sharedHistory}
              {completedSharedRides.length > 0 && (
                <Badge variant="secondary" className="ml-1">{completedSharedRides.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recurring" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              {t.myBookings.recurring}
              {recurringBookings.length > 0 && (
                <Badge variant="secondary" className="ml-1">{recurringBookings.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-6">
            {/* Search, Filter, and View Toggle Bar */}
            {bookings.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t.myBookings.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="ps-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder={t.myBookingsMisc.filterByStatus} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t.myBookings.allBookings} ({statusCounts.all})
                        </SelectItem>
                        <SelectItem value="pending">
                          {t.status.pending} ({statusCounts.pending})
                        </SelectItem>
                        <SelectItem value="confirmed">
                          {t.status.confirmed} ({statusCounts.confirmed})
                        </SelectItem>
                        <SelectItem value="completed">
                          {t.status.completed} ({statusCounts.completed})
                        </SelectItem>
                        <SelectItem value="cancelled">
                          {t.status.cancelled} ({statusCounts.cancelled})
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Export Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" title={(t as any).myBookingsExt?.exportBookings || 'Export bookings'}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          const upcomingBookings = bookings.filter(b => 
                            b.status !== 'cancelled' && b.status !== 'completed'
                          );
                          if (upcomingBookings.length === 0) {
                            toast.error(t.myBookings.noUpcomingBookings);
                            return;
                          }
                          const icsContent = generateICalEvents(upcomingBookings);
                          downloadICalFile(icsContent, 'upcoming-bookings.ics');
                          toast.success(t.myBookings.exported.replace('{count}', String(upcomingBookings.length)));
                        }}>
                          <Calendar className="h-4 w-4 mr-2" />
                          {t.myBookings.exportUpcoming}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          if (bookings.length === 0) {
                            toast.error(t.myBookings.noBookingsToExport);
                            return;
                          }
                          const icsContent = generateICalEvents(bookings);
                          downloadICalFile(icsContent, 'all-bookings.ics');
                          toast.success(t.myBookings.exported.replace('{count}', String(bookings.length)));
                        }}>
                          <Download className="h-4 w-4 mr-2" />
                          {t.myBookings.exportAllFiltered}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* View Toggle */}
                    <ToggleGroup 
                      type="single" 
                      value={viewMode} 
                      onValueChange={(value) => value && setViewMode(value as 'list' | 'calendar')}
                      className="border border-border rounded-md"
                    >
                      <ToggleGroupItem value="list" aria-label="List view" className="px-3">
                        <List className="h-4 w-4" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="calendar" aria-label="Calendar view" className="px-3">
                        <CalendarDays className="h-4 w-4" />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>

                {/* Active Filter Indicator */}
                {(statusFilter !== 'all' || showSharedRidesOnly) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">{t.myBookings.activeFilters}</span>
                    {statusFilter !== 'all' && (
                      <Badge variant="secondary" className="gap-1">
                        {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} bookings
                        <button
                          onClick={() => setStatusFilter('all')}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {showSharedRidesOnly && (
                      <Badge variant="secondary" className="gap-1">
                        {t.myBookings.pendingInvitationsOnly}
                        <button
                          onClick={() => setShowSharedRidesOnly(false)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStatusFilter('all');
                        setShowSharedRidesOnly(false);
                      }}
                      className="text-xs h-6"
                    >
                      {t.myBookings.clearAll}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <Car className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
                  {t.myBookings.noBookingsYet}
                </h2>
                <p className="mb-6 text-muted-foreground">
                  {t.myBookings.noBookingsDescription}
                </p>
                <Button variant="booking" onClick={() => navigate('/')}>
                  {t.myBookings.bookFirstRide}
                </Button>
              </div>
            ) : viewMode === 'calendar' ? (
              /* Calendar View */
              <BookingsCalendarView 
                bookings={bookings} 
                onRebook={handleRebook}
                onReschedule={handleReschedule}
              />
            ) : bookings.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-2 font-display text-xl font-semibold text-foreground">
                  {t.myBookings.noMatchingBookings}
                </h2>
                <p className="mb-6 text-muted-foreground">
                  {t.myBookings.noMatchingDescription}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  {t.myBookings.clearFilters}
                </Button>
              </div>
            ) : (
              /* List View */
              <div className="space-y-4">
                <div className="grid gap-4">
                  {!showSharedRidesOnly && bookings.map((booking, index) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      index={(pagination.page - 1) * pagination.pageSize + index}
                      onCancelled={() => { fetchBookings(); fetchStatusCounts(); }}
                      onRebook={handleRebook}
                    />
                  ))}
                  {showSharedRidesOnly && bookings.length > 0 && !sharedRides.some(s => !s.is_accepted) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{t.myBookings.noPendingShareInvitations}</p>
                      <Button 
                        variant="link" 
                        onClick={() => setShowSharedRidesOnly(false)}
                        className="mt-2"
                      >
                        {t.myBookings.viewAllBookings}
                      </Button>
                    </div>
                  )}
                </div>
                {!showSharedRidesOnly && pagination.totalCount > 0 && (
                  <TablePagination
                    page={pagination.page}
                    pageSize={pagination.pageSize}
                    totalCount={pagination.totalCount}
                    totalPages={pagination.totalPages}
                    from={pagination.from}
                    to={pagination.to}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                    pageSizeOptions={[5, 10, 25, 50]}
                  />
                )}
              </div>
            )}


            {/* Shared Rides Section */}
            {sharedRides.length > 0 && (
              <div className={showSharedRidesOnly ? "mt-0" : "mt-8"}>
                <div className="mb-6 flex items-center gap-3 flex-wrap">
                  <Share2 className="h-5 w-5 text-accent" />
                  <h2 className="font-display text-xl font-bold text-foreground">
                    {showSharedRidesOnly ? t.myBookings.pendingShareInvitations : t.myBookings.ridesSharedWithMe}
                  </h2>
                  <Badge variant="secondary">
                    {showSharedRidesOnly 
                      ? sharedRides.filter(s => !s.is_accepted).length 
                      : sharedRides.length}
                  </Badge>
                  {showSharedRidesOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSharedRidesOnly(false)}
                      className="ml-auto gap-1"
                    >
                      <X className="h-3 w-3" />
                      {t.myBookings.clearFilters}
                    </Button>
                  )}
                </div>

                <div className="grid gap-4">
                  {sharedRides
                    .filter(share => showSharedRidesOnly ? !share.is_accepted : true)
                    .map((share) => {
                    const booking = share.booking;
                    if (!booking) return null;
                    
                    const transferInfo = transferTypeLabels[booking.transfer_type];
                    
                    return (
                      <div
                        key={share.id}
                        className="rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-6 transition-shadow hover:shadow-medium"
                      >
                        {/* Header with badges */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="font-display text-base sm:text-lg font-semibold text-foreground">
                            {booking.booking_reference}
                          </span>
                          <span className={`rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium ${statusColors[booking.status]}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            {transferInfo.icon}
                            {transferInfo.label}
                          </span>
                          {share.is_accepted ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              <Check className="mr-1 h-3 w-3" />
                              {t.myBookings.accepted}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              {t.status.pending}
                            </Badge>
                          )}
                        </div>

                        <div className="mb-3 text-sm text-muted-foreground">
                          {t.myBookings.sharedBy} <span className="font-medium text-foreground">{share.sharer_email}</span>
                        </div>

                        {/* Route and Schedule Info */}
                        <div className="grid gap-2 text-sm sm:grid-cols-2 mb-4">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                            <span className="text-foreground break-words">{booking.pickup_location}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <span className="text-foreground break-words">{booking.dropoff_location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              {format(new Date(booking.pickup_date), 'PPP')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{booking.pickup_time}</span>
                          </div>
                        </div>

                        {/* Vehicle, Cost Split, and Actions - Responsive Layout */}
                        <div className="flex flex-col gap-4 pt-3 border-t border-accent/20 sm:flex-row sm:items-end sm:justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Car className="h-4 w-4 shrink-0" />
                            {booking.vehicle_name}
                          </div>
                          
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                            {/* Cost Split with actual amounts */}
                            <div className="rounded-lg bg-accent/10 px-4 py-3 text-center">
                              {booking.total_price > 0 ? (
                                <>
                                  <div className="text-xs text-muted-foreground mb-1">{t.myBookings.yourShare} ({share.cost_split_percentage}%)</div>
                                  <div className="text-xl font-bold text-accent">
                                    {formatPrice((booking.total_price * share.cost_split_percentage) / 100)}
                                  </div>
                                   <div className="text-xs text-muted-foreground mt-1">
                                    {t.myBookings.ofTotal.replace('{amount}', formatPrice(booking.total_price))}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-xs text-muted-foreground">{t.myBookings.yourShare}</div>
                                  <div className="text-lg font-bold text-accent">
                                    {share.cost_split_percentage}%
                                  </div>
                                </>
                              )}
                            </div>

                            {!share.is_accepted && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => openAcceptDialog(share)}
                                  className="gap-2 flex-1 sm:flex-none"
                                  disabled={acceptShare.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                  Accept
                                </Button>
                                <AlertDialog>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t.myBookings.declineThisRideShare}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t.myBookings.declineShareDescription.replace('{email}', share.sharer_email || '')}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeclineShare(share.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {t.myBookings.declineInvitation}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                                    disabled={declineShare.isPending}
                                  >
                                    <X className="h-4 w-4" />
                                    {t.myBookings.decline}
                                  </Button>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <SharedRidesHistory 
              completedShares={completedSharedRides as any} 
              isLoading={isLoadingHistory} 
            />
          </TabsContent>

          <TabsContent value="recurring" className="space-y-6">
            <div className="flex justify-end">
              <RecurringBookingDialog vehicles={vehicles} />
            </div>
            <RecurringBookingsList vehicles={vehicles} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Accept Share Confirmation Dialog */}
      <AcceptShareConfirmDialog
        open={acceptDialogOpen}
        onOpenChange={setAcceptDialogOpen}
        booking={selectedShareForAccept?.booking}
        sharerEmail={selectedShareForAccept?.sharer_email}
        costSplitPercentage={selectedShareForAccept?.cost_split_percentage || 50}
        onConfirm={handleConfirmAccept}
        isPending={acceptShare.isPending}
      />
      <Footer />
    </div>
  );
}
