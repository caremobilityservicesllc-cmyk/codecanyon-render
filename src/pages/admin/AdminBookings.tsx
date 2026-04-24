import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Filter, Pencil, Trash2, MoreHorizontal, Tag, Zap, CheckCircle, Play, DollarSign, Plane, Receipt, Building2 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { sendBookingEmail } from '@/hooks/useBookingEmail';
import { SmartDriverAssignment } from '@/components/admin/drivers/SmartDriverAssignment';
import { RideTimeRemainingCompact } from '@/components/booking/RideTimeRemainingCompact';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { TablePagination } from '@/components/admin/TablePagination';
import { useServerPagination } from '@/hooks/useServerPagination';
import {
  MobileDataCard,
  MobileDataRow,
  MobileDataHeader,
  MobileDataList,
} from '@/components/admin/MobileDataCard';
import type { Database } from '@/integrations/supabase/types';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface BookingWithPromo {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  vehicle_name: string;
  status: BookingStatus;
  user_id: string | null;
  passengers: number;
  total_price: number | null;
  discount_amount: number | null;
  promo_code_id: string | null;
  driver_id: string | null;
  created_at: string;
  ride_started_at: string | null;
  ride_completed_at: string | null;
  booking_fee: number | null;
  toll_charges: number | null;
  airport_charges: number | null;
  cancellation_fee: number | null;
  payment_method: string;
  bank_transfer_details: any | null;
  promo_codes: {
    code: string;
    discount_percentage: number;
  } | null;
  drivers: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

const statusOptions: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export default function AdminBookings() {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const [bookings, setBookings] = useState<BookingWithPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithPromo | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [bankDetailsDialogOpen, setBankDetailsDialogOpen] = useState(false);
  const [bankDetailsBooking, setBankDetailsBooking] = useState<BookingWithPromo | null>(null);
  const [newStatus, setNewStatus] = useState<BookingStatus>('pending');
  const [editTollCharges, setEditTollCharges] = useState(0);
  const [editAirportCharges, setEditAirportCharges] = useState(0);
  const [editBookingFee, setEditBookingFee] = useState(0);
  const [editCancellationFee, setEditCancellationFee] = useState(0);

  const pagination = useServerPagination({ defaultPageSize: 10 });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t.status.pending;
      case 'confirmed': return t.status.confirmed;
      case 'completed': return t.status.completed;
      case 'cancelled': return t.status.cancelled;
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select(`
          id,
          booking_reference,
          pickup_location,
          dropoff_location,
          pickup_date,
          pickup_time,
          vehicle_name,
          status,
          user_id,
          passengers,
          total_price,
          discount_amount,
          promo_code_id,
          driver_id,
          created_at,
          ride_started_at,
          ride_completed_at,
          booking_fee,
          toll_charges,
          airport_charges,
          cancellation_fee,
          payment_method,
          bank_transfer_details,
          promo_codes (
            code,
            discount_percentage
          ),
          drivers (
            id,
            first_name,
            last_name,
            avatar_url
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (statusFilter === 'bank_pending') {
        query = query.eq('status', 'pending' as BookingStatus).eq('payment_method', 'bank');
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as BookingStatus);
      }

      if (searchQuery.trim()) {
        query = query.or(`booking_reference.ilike.%${searchQuery}%,pickup_location.ilike.%${searchQuery}%,dropoff_location.ilike.%${searchQuery}%`);
      }

      query = query.range(pagination.rangeFrom, pagination.rangeTo);

      const { data, error, count } = await query;

      if (error) throw error;
      setBookings((data as BookingWithPromo[]) || []);
      pagination.setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error(t.admin.failedToLoadBookings);
    } finally {
      setLoading(false);
    }
  }, [pagination.rangeFrom, pagination.rangeTo, statusFilter, searchQuery]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Reset page when filters change
  useEffect(() => {
    pagination.resetPage();
  }, [searchQuery, statusFilter]);

  const handleStatusUpdate = async () => {
    if (!selectedBooking) return;

    try {
      const originalTotal = Number(selectedBooking.total_price) || 0;
      const originalToll = Number(selectedBooking.toll_charges) || 0;
      const originalAirport = Number(selectedBooking.airport_charges) || 0;
      const originalBookingFee = Number(selectedBooking.booking_fee) || 0;
      const originalCancellation = Number(selectedBooking.cancellation_fee) || 0;
      const discount = Number(selectedBooking.discount_amount) || 0;

      const baseFare = originalTotal - originalToll - originalAirport - originalBookingFee - originalCancellation + discount;
      const newTotal = baseFare + editTollCharges + editAirportCharges + editBookingFee + editCancellationFee - discount;

      const { error } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          toll_charges: editTollCharges,
          airport_charges: editAirportCharges,
          booking_fee: editBookingFee,
          cancellation_fee: editCancellationFee,
          total_price: Math.max(0, newTotal),
        })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setBookings(prev =>
        prev.map(b => b.id === selectedBooking.id ? {
          ...b,
          status: newStatus,
          toll_charges: editTollCharges,
          airport_charges: editAirportCharges,
          booking_fee: editBookingFee,
          cancellation_fee: editCancellationFee,
          total_price: Math.max(0, newTotal),
        } : b)
      );
      toast.success(t.admin.bookingUpdated);
      setEditDialogOpen(false);

      if (selectedBooking.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', selectedBooking.user_id)
          .single();

        if (profile?.email) {
          const emailType = newStatus === 'cancelled' ? 'cancelled' : 'updated';
          sendBookingEmail({
            type: emailType,
            email: profile.email,
            bookingReference: selectedBooking.booking_reference,
            pickupLocation: selectedBooking.pickup_location,
            dropoffLocation: selectedBooking.dropoff_location,
            pickupDate: format(new Date(selectedBooking.pickup_date), 'MMMM d, yyyy'),
            pickupTime: selectedBooking.pickup_time,
            vehicleName: selectedBooking.vehicle_name,
            passengers: selectedBooking.passengers,
            status: newStatus,
          });
        }
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error(t.admin.failedToUpdateBooking);
    }
  };

  const handleConfirmAndAssign = async () => {
    if (!selectedBooking) return;

    try {
      const { data: dispatchResult, error: dispatchError } = await supabase.functions.invoke('auto-dispatch', {
        body: { bookingId: selectedBooking.id, action: 'confirm_and_dispatch' },
      });

      if (dispatchError) throw dispatchError;

      await fetchBookings();
      
      if (dispatchResult?.driver) {
        toast.success(t.admin.bookingConfirmedDriver.replace('{driver}', dispatchResult.driver.first_name));
      } else {
        toast.success(t.admin.bookingConfirmedNoDriver);
      }
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast.error(t.admin.failedToConfirmBooking);
    }
  };

  const handleConfirmBankPayment = async (booking: BookingWithPromo) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed' as BookingStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (error) throw error;

      setBookings(prev =>
        prev.map(b => b.id === booking.id
          ? { ...b, status: 'confirmed' as BookingStatus }
          : b
        )
      );
      toast.success(`${t.admin.bankPaymentConfirmed} ${booking.booking_reference}`);

      if (booking.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', booking.user_id)
          .single();

        if (profile?.email) {
          sendBookingEmail({
            type: 'bank_payment_confirmed' as any,
            email: profile.email,
            bookingReference: booking.booking_reference,
            pickupLocation: booking.pickup_location,
            dropoffLocation: booking.dropoff_location,
            pickupDate: format(new Date(booking.pickup_date), 'MMMM d, yyyy'),
            pickupTime: booking.pickup_time,
            vehicleName: booking.vehicle_name,
            passengers: booking.passengers,
            status: 'confirmed',
          });
        }
      }
    } catch (error) {
      console.error('Error confirming bank payment:', error);
      toast.error(t.admin.failedToConfirmBank);
    }
  };

  const handleDriverAssigned = (driverId: string | null, driverName: string | null) => {
    if (!selectedBooking) return;
    
    setBookings(prev =>
      prev.map(b => b.id === selectedBooking.id 
        ? { 
            ...b, 
            driver_id: driverId,
            drivers: driverId && driverName ? {
              id: driverId,
              first_name: driverName.split(' ')[0],
              last_name: driverName.split(' ').slice(1).join(' '),
              avatar_url: null
            } : null
          } 
        : b
      )
    );
    setAssignDriverDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!selectedBooking) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', selectedBooking.id);

      if (error) throw error;

      toast.success(t.admin.bookingDeleted);
      setDeleteDialogOpen(false);
      fetchBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error(t.admin.failedToDeleteBooking);
    }
  };

  const handleStartRide = async (booking: BookingWithPromo) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          ride_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (error) throw error;

      setBookings(prev =>
        prev.map(b => b.id === booking.id 
          ? { ...b, ride_started_at: new Date().toISOString() } 
          : b
        )
      );
      toast.success(`${t.admin.rideStarted} ${booking.booking_reference}`);
    } catch (error) {
      console.error('Error starting ride:', error);
      toast.error(t.admin.failedToStartRide);
    }
  };

  const handleCompleteRide = async (booking: BookingWithPromo) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          ride_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (error) throw error;

      setBookings(prev =>
        prev.map(b => b.id === booking.id 
          ? { ...b, status: 'completed' as BookingStatus, ride_completed_at: new Date().toISOString() } 
          : b
        )
      );
      toast.success(`${t.admin.rideCompleted} ${booking.booking_reference}`);
    } catch (error) {
      console.error('Error completing ride:', error);
      toast.error(t.admin.failedToCompleteRide);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AdminLayout
      title={t.nav.bookings}
      description={t.admin.manageBookings}
    >
      <div className="space-y-6">

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t.admin.searchBookings}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t.admin.filterByStatus} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.admin.allStatuses}</SelectItem>
              <SelectItem value="bank_pending">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                  {t.admin.bankPending}
                </span>
              </SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {getStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden">
          <MobileDataList
            isLoading={loading}
            loadingText={t.admin.loadingBookings}
            isEmpty={bookings.length === 0}
            emptyText={t.admin.noBookingsFound}
          >
            {bookings.map((booking) => (
              <MobileDataCard key={booking.id}>
                <MobileDataHeader
                  title={
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{booking.booking_reference}</span>
                      {booking.ride_started_at && !booking.ride_completed_at ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white animate-pulse text-xs">
                          <Play className="h-3 w-3 mr-1" />
                          {t.admin.inProgress}
                        </Badge>
                      ) : (
                        <Badge className={getStatusColor(booking.status)}>
                          {getStatusLabel(booking.status)}
                        </Badge>
                      )}
                      {booking.status === 'pending' && booking.payment_method === 'bank' && (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-500 text-xs gap-1">
                          <Building2 className="h-3 w-3" />
                          Bank
                        </Badge>
                      )}
                    </div>
                  }
                  actions={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {booking.status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedBooking(booking);
                              handleConfirmAndAssign();
                            }}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {t.admin.confirmAutoAssign}
                          </DropdownMenuItem>
                        )}
                        {booking.status === 'pending' && booking.payment_method === 'bank' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setBankDetailsBooking(booking);
                              setBankDetailsDialogOpen(true);
                            }}
                          >
                            <Building2 className="mr-2 h-4 w-4" />
                            {t.admin.confirmBankPayment}
                          </DropdownMenuItem>
                        )}
                        {booking.status === 'confirmed' && !booking.ride_started_at && (
                          <DropdownMenuItem onClick={() => handleStartRide(booking)}>
                            <Play className="mr-2 h-4 w-4" />
                            {t.admin.startRide}
                          </DropdownMenuItem>
                        )}
                        {booking.status === 'confirmed' && booking.ride_started_at && !booking.ride_completed_at && (
                          <DropdownMenuItem onClick={() => handleCompleteRide(booking)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {t.admin.completeRide}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedBooking(booking);
                            setAssignDriverDialogOpen(true);
                          }}
                        >
                          <Zap className="mr-2 h-4 w-4" />
                          {t.admin.smartAssignDriver}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedBooking(booking);
                            setNewStatus(booking.status);
                            setEditTollCharges(booking.toll_charges || 0);
                            setEditAirportCharges(booking.airport_charges || 0);
                            setEditBookingFee(booking.booking_fee || 0);
                            setEditCancellationFee(booking.cancellation_fee || 0);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          {t.admin.editBooking}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t.common.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
                <MobileDataRow label={t.admin.pickup}>
                  <span className="truncate max-w-[180px]">{booking.pickup_location}</span>
                </MobileDataRow>
                <MobileDataRow label={t.admin.dropoff}>
                  <span className="truncate max-w-[180px]">{booking.dropoff_location}</span>
                </MobileDataRow>
                <MobileDataRow label={t.admin.dateTime}>
                  {format(new Date(booking.pickup_date), 'MMM dd, yyyy')} · {booking.pickup_time}
                </MobileDataRow>
                <MobileDataRow label={t.admin.vehicle}>{booking.vehicle_name}</MobileDataRow>
                <MobileDataRow label={t.admin.driver}>
                  {booking.drivers ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={booking.drivers.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {booking.drivers.first_name[0]}{booking.drivers.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>{booking.drivers.first_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{t.admin.unassigned}</span>
                  )}
                </MobileDataRow>
                {booking.promo_codes && (
                  <MobileDataRow label={t.admin.promo}>
                    <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                      <Tag className="h-3 w-3" />
                      {booking.promo_codes.code} ({booking.promo_codes.discount_percentage}%)
                    </Badge>
                  </MobileDataRow>
                )}
                {booking.total_price !== null && (
                  <MobileDataRow label={t.common.price}>
                    <span className="font-semibold">{formatPrice(booking.total_price)}</span>
                    {booking.discount_amount && booking.discount_amount > 0 && (
                      <span className="text-primary ml-1">(-{formatPrice(booking.discount_amount)})</span>
                    )}
                  </MobileDataRow>
                )}
                {booking.ride_started_at && !booking.ride_completed_at && (
                  <div className="pt-2 border-t border-border">
                    <RideTimeRemainingCompact
                      pickupLocation={booking.pickup_location}
                      dropoffLocation={booking.dropoff_location}
                      rideStartedAt={booking.ride_started_at}
                    />
                  </div>
                )}
              </MobileDataCard>
            ))}
          </MobileDataList>

          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block rounded-xl border border-border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.admin.reference}</TableHead>
                <TableHead>{t.admin.pickup}</TableHead>
                <TableHead>{t.admin.dropoff}</TableHead>
                <TableHead>{t.admin.dateTime}</TableHead>
                <TableHead>{t.admin.vehicle}</TableHead>
                <TableHead>{t.admin.driver}</TableHead>
                <TableHead>{t.admin.promo}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {t.admin.noBookingsFound}
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.booking_reference}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{booking.pickup_location}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{booking.dropoff_location}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(booking.pickup_date), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">{booking.pickup_time}</div>
                    </TableCell>
                    <TableCell>{booking.vehicle_name}</TableCell>
                    <TableCell>
                      {booking.drivers ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={booking.drivers.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {booking.drivers.first_name[0]}{booking.drivers.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{booking.drivers.first_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">{t.admin.unassigned}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {booking.promo_codes ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                              <Tag className="h-3 w-3" />
                              {booking.promo_codes.code}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{booking.promo_codes.discount_percentage}% {t.admin.discountApplied}</p>
                            {booking.discount_amount && booking.discount_amount > 0 && (
                              <p className="text-primary">{t.admin.saved}: {formatPrice(booking.discount_amount)}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {booking.ride_started_at && !booking.ride_completed_at ? (
                        <div className="space-y-1.5">
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white animate-pulse">
                            <Play className="h-3 w-3 mr-1" />
                            {t.admin.inProgress}
                          </Badge>
                          <RideTimeRemainingCompact
                            pickupLocation={booking.pickup_location}
                            dropoffLocation={booking.dropoff_location}
                            rideStartedAt={booking.ride_started_at}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Badge className={getStatusColor(booking.status)}>
                            {getStatusLabel(booking.status)}
                          </Badge>
                          {booking.status === 'pending' && booking.payment_method === 'bank' && (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-500 text-xs gap-1 w-fit">
                              <Building2 className="h-3 w-3" />
                              Bank
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {booking.status === 'pending' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedBooking(booking);
                                handleConfirmAndAssign();
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {t.admin.confirmAutoAssign}
                            </DropdownMenuItem>
                          )}
                          {booking.status === 'pending' && booking.payment_method === 'bank' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setBankDetailsBooking(booking);
                                setBankDetailsDialogOpen(true);
                              }}
                            >
                              <Building2 className="mr-2 h-4 w-4" />
                              {t.admin.confirmBankPayment}
                            </DropdownMenuItem>
                          )}
                          {booking.status === 'confirmed' && !booking.ride_started_at && (
                            <DropdownMenuItem onClick={() => handleStartRide(booking)}>
                              <Play className="mr-2 h-4 w-4" />
                              {t.admin.startRide}
                            </DropdownMenuItem>
                          )}
                          {booking.status === 'confirmed' && booking.ride_started_at && !booking.ride_completed_at && (
                            <DropdownMenuItem onClick={() => handleCompleteRide(booking)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {t.admin.completeRide}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedBooking(booking);
                              setAssignDriverDialogOpen(true);
                            }}
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            {t.admin.smartAssignDriver}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedBooking(booking);
                              setNewStatus(booking.status);
                              setEditTollCharges(booking.toll_charges || 0);
                              setEditAirportCharges(booking.airport_charges || 0);
                              setEditBookingFee(booking.booking_fee || 0);
                              setEditCancellationFee(booking.cancellation_fee || 0);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {t.admin.editBooking}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t.common.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      </div>

      {/* Edit Booking Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.admin.editBooking}</DialogTitle>
            <DialogDescription>
              {t.admin.updateStatusFees} {selectedBooking?.booking_reference}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.common.status}</label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as BookingStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fee Fields */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                {t.admin.additionalCharges}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {t.admin.bookingFee}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editBookingFee}
                    onChange={(e) => setEditBookingFee(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {t.admin.tollCharges}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editTollCharges}
                    onChange={(e) => setEditTollCharges(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Plane className="h-3 w-3" />
                    {t.admin.airportCharges}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editAirportCharges}
                    onChange={(e) => setEditAirportCharges(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {t.admin.cancellationFee}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editCancellationFee}
                    onChange={(e) => setEditCancellationFee(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Summary with recalculated total */}
            {selectedBooking && (() => {
              const originalTotal = Number(selectedBooking.total_price) || 0;
              const originalToll = Number(selectedBooking.toll_charges) || 0;
              const originalAirport = Number(selectedBooking.airport_charges) || 0;
              const originalBookingFee = Number(selectedBooking.booking_fee) || 0;
              const originalCancellation = Number(selectedBooking.cancellation_fee) || 0;
              const discount = Number(selectedBooking.discount_amount) || 0;
              const baseFare = originalTotal - originalToll - originalAirport - originalBookingFee - originalCancellation + discount;
              const newTotal = Math.max(0, baseFare + editTollCharges + editAirportCharges + editBookingFee + editCancellationFee - discount);

              return (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.admin.baseFare}</span>
                    <span>{formatPrice(baseFare)}</span>
                  </div>
                  {editBookingFee > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t.admin.bookingFee}</span>
                      <span>{formatPrice(editBookingFee)}</span>
                    </div>
                  )}
                  {editTollCharges > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t.admin.tollCharges}</span>
                      <span>{formatPrice(editTollCharges)}</span>
                    </div>
                  )}
                  {editAirportCharges > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t.admin.airportCharges}</span>
                      <span>{formatPrice(editAirportCharges)}</span>
                    </div>
                  )}
                  {editCancellationFee > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t.admin.cancellationFee}</span>
                      <span>{formatPrice(editCancellationFee)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-accent">
                      <span>{t.admin.discount}</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <span className="font-medium">{t.admin.newTotal}</span>
                    <span className="text-lg font-bold text-primary">{formatPrice(newTotal)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleStatusUpdate}>{t.common.saveChanges}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin.deleteBooking}</DialogTitle>
            <DialogDescription>
              {t.admin.deleteBookingConfirm.replace('{ref}', selectedBooking?.booking_reference || '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Assign Driver Dialog */}
      <Dialog open={assignDriverDialogOpen} onOpenChange={setAssignDriverDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {t.admin.smartDriverAssignment}
            </DialogTitle>
            <DialogDescription>
              {t.admin.smartDriverDesc} {selectedBooking?.booking_reference}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {selectedBooking && (
              <SmartDriverAssignment
                bookingId={selectedBooking.id}
                currentDriverId={selectedBooking.driver_id}
                onAssigned={handleDriverAssigned}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Transfer Details Dialog */}
      <Dialog open={bankDetailsDialogOpen} onOpenChange={setBankDetailsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {t.admin.bankTransferDetails}
            </DialogTitle>
            <DialogDescription>
              {t.admin.reviewTransferDetails.replace('{ref}', bankDetailsBooking?.booking_reference || '')}
            </DialogDescription>
          </DialogHeader>
          {bankDetailsBooking?.bank_transfer_details ? (
            <div className="space-y-3 py-2">
              {[
                { label: t.admin.senderName, value: bankDetailsBooking.bank_transfer_details.senderName },
                { label: t.admin.bankName, value: bankDetailsBooking.bank_transfer_details.bankName },
                { label: t.admin.transferReference, value: bankDetailsBooking.bank_transfer_details.transferReference },
                { label: t.admin.transferDate, value: bankDetailsBooking.bank_transfer_details.transferDate },
                { label: t.admin.amountTransferred, value: bankDetailsBooking.bank_transfer_details.amountTransferred },
                { label: t.booking.notes, value: bankDetailsBooking.bank_transfer_details.notes },
              ].filter(item => item.value).map((item) => (
                <div key={item.label} className="flex justify-between items-start gap-4">
                  <span className="text-sm text-muted-foreground shrink-0">{item.label}</span>
                  <span className="text-sm font-medium text-foreground text-right">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              {t.admin.noBankDetails}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBankDetailsDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => {
                if (bankDetailsBooking) {
                  handleConfirmBankPayment(bankDetailsBooking);
                  setBankDetailsDialogOpen(false);
                  setBankDetailsBooking(null);
                }
              }}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t.admin.confirmPayment}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
