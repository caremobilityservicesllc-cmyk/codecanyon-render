import { useEffect, useState } from 'react';
import { Calendar, Car, DollarSign, Users, Clock, TrendingUp } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatCard } from '@/components/admin/StatCard';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ApiQuotaAlertBanner } from '@/components/admin/ApiQuotaAlertBanner';
import { TrafficHeatmapWidget } from '@/components/admin/TrafficHeatmapWidget';
import { TrafficForecastWidget } from '@/components/admin/TrafficForecastWidget';
import { DriverDeploymentWidget } from '@/components/admin/DriverDeploymentWidget';
import { PendingDocumentsWidget } from '@/components/admin/PendingDocumentsWidget';
import { DriverEarningsSummaryWidget } from '@/components/admin/DriverEarningsSummaryWidget';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
}

interface RecentBooking {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  status: string;
  vehicle_name: string;
}

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<BookingStats>({ total: 0, pending: 0, confirmed: 0, completed: 0 });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select('status');

        if (error) throw error;

        const statsData = {
          total: bookings?.length || 0,
          pending: bookings?.filter(b => b.status === 'pending').length || 0,
          confirmed: bookings?.filter(b => b.status === 'confirmed').length || 0,
          completed: bookings?.filter(b => b.status === 'completed').length || 0,
        };
        setStats(statsData);

        const { data: recent, error: recentError } = await supabase
          .from('bookings')
          .select('id, booking_reference, pickup_location, dropoff_location, pickup_date, pickup_time, status, vehicle_name')
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentError) throw recentError;
        setRecentBookings(recent || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

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
      title={t.admin.dashboard} 
      description={t.admin.dashboardWelcome}
    >
      <div className="space-y-6">
        <ApiQuotaAlertBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title={t.admin.totalBookings}
            value={stats.total}
            icon={<Calendar className="h-6 w-6" />}
            trend={{ value: 12, label: t.admin.vsLastMonth }}
          />
          <StatCard
            title={t.status.pending}
            value={stats.pending}
            icon={<Clock className="h-6 w-6" />}
          />
          <StatCard
            title={t.status.confirmed}
            value={stats.confirmed}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title={t.status.completed}
            value={stats.completed}
            icon={<Car className="h-6 w-6" />}
          />
          <PendingDocumentsWidget />
        </div>

        <DriverEarningsSummaryWidget />
        <TrafficForecastWidget />
        <DriverDeploymentWidget />
        <TrafficHeatmapWidget />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {t.admin.recentBookings}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : recentBookings.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t.admin.noBookingsYet}</p>
            ) : (
              <div className="space-y-4">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {booking.booking_reference}
                        </span>
                        <Badge className={cn("flex-shrink-0", getStatusColor(booking.status))}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {booking.pickup_location} → {booking.dropoff_location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(booking.pickup_date), 'MMM dd, yyyy')} at {booking.pickup_time}
                      </p>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <p className="text-sm font-medium text-foreground">{booking.vehicle_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
