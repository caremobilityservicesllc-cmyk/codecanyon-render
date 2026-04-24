import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mail, Clock, Play, RefreshCw, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminNotifications() {
  const { t } = useLanguage();
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  // Fetch tomorrow's bookings that would receive reminders
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: upcomingReminders, isLoading: loadingReminders, refetch: refetchReminders } = useQuery({
    queryKey: ['admin-upcoming-reminders', tomorrowStr],
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, profiles:user_id(email, full_name)')
        .eq('pickup_date', tomorrowStr)
        .in('status', ['pending', 'confirmed'])
        .not('user_id', 'is', null);

      if (error) throw error;
      return bookings;
    },
  });

  // Fetch recent bookings for email history simulation
  const { data: recentBookings, isLoading: loadingRecent } = useQuery({
    queryKey: ['admin-recent-bookings-emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_reference, created_at, status, vehicle_name, user_id')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const handleTriggerReminders = async () => {
    setIsSendingReminders(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-booking-reminders');

      if (error) throw error;

      setLastResult({
        success: true,
        message: data.message || 'Reminders sent successfully',
        count: data.count,
      });
      toast.success(data.message || t.adminNotifications.remindersSent);
      refetchReminders();
    } catch (error: any) {
      console.error('Error triggering reminders:', error);
      setLastResult({
        success: false,
        message: error.message || t.adminNotifications.failedToSendReminders,
      });
      toast.error(t.adminNotifications.failedToSendReminders);
    } finally {
      setIsSendingReminders(false);
    }
  };

  return (
    <AdminLayout
      title={t.admin.notificationsTitle}
      description={t.admin.notificationsDesc}
    >
      <div className="space-y-6">

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                {t.admin.bookingReminders}
              </CardTitle>
              <CardDescription>
                {t.admin.bookingRemindersDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.admin.pendingReminders}:</span>
                  <Badge variant="secondary">
                    {loadingReminders ? '...' : upcomingReminders?.length || 0}
                  </Badge>
                </div>
                <Button
                  onClick={handleTriggerReminders}
                  disabled={isSendingReminders || !upcomingReminders?.length}
                  className="w-full"
                >
                  {isSendingReminders ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      {t.admin.sending}
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      {t.admin.sendRemindersNow}
                    </>
                  )}
                </Button>
                {lastResult && (
                  <div
                    className={`flex items-center gap-2 rounded-md p-2 text-sm ${
                      lastResult.success
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {lastResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {lastResult.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                {t.admin.scheduledJobs}
              </CardTitle>
              <CardDescription>
                {t.admin.automatedTasks}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t.admin.dailyReminders}</span>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
                      {t.status.active}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.admin.runsDaily}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                {t.admin.emailTypes}
              </CardTitle>
              <CardDescription>
                {t.admin.automatedEmails}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t.admin.bookingConfirmation}</span>
                  <Badge variant="outline" className="text-green-600">{t.admin.enabled}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{t.admin.statusUpdates}</span>
                  <Badge variant="outline" className="text-green-600">{t.admin.enabled}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{t.admin.reminders}</span>
                  <Badge variant="outline" className="text-green-600">{t.admin.enabled}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{t.admin.cancellations}</span>
                  <Badge variant="outline" className="text-green-600">{t.admin.enabled}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tomorrow's Reminders */}
        <Card>
          <CardHeader>
            <CardTitle>{t.admin.tomorrowsBookings}</CardTitle>
            <CardDescription>
              {t.admin.tomorrowsBookingsDesc} ({format(tomorrow, 'MMMM d, yyyy')})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.reference}</TableHead>
                  <TableHead>{t.admin.customer}</TableHead>
                  <TableHead>{t.common.email}</TableHead>
                  <TableHead>{t.admin.pickupTime}</TableHead>
                  <TableHead>{t.admin.vehicle}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReminders ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : upcomingReminders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t.admin.noBookingsTomorrow}
                    </TableCell>
                  </TableRow>
                ) : (
                  upcomingReminders?.map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.booking_reference}</TableCell>
                      <TableCell>{booking.profiles?.full_name || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {booking.profiles?.email || t.admin.noEmail}
                      </TableCell>
                      <TableCell>{booking.pickup_time}</TableCell>
                      <TableCell>{booking.vehicle_name}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            booking.status === 'confirmed'
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-yellow-500/10 text-yellow-600'
                          }
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>{t.admin.recentBookingActivity}</CardTitle>
            <CardDescription>
              {t.admin.recentBookingActivityDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.reference}</TableHead>
                  <TableHead>{t.admin.created}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.admin.vehicle}</TableHead>
                  <TableHead>{t.admin.emailSent}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRecent ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : recentBookings?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {t.admin.noRecentBookings}
                    </TableCell>
                  </TableRow>
                ) : (
                  recentBookings?.map((booking) => (
                    <TableRow key={booking.booking_reference}>
                      <TableCell className="font-medium">{booking.booking_reference}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(booking.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{booking.status}</Badge>
                      </TableCell>
                      <TableCell>{booking.vehicle_name}</TableCell>
                      <TableCell>
                        {booking.user_id ? (
                          <Badge className="bg-green-500/10 text-green-600">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            {t.admin.sent}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t.admin.guest}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
