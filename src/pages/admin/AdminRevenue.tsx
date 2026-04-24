import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { DollarSign, TrendingUp, MapPin, Users, Calendar, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { RefundHistoryView } from '@/components/admin/RefundHistoryView';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

type TimeRange = '7d' | '30d' | '90d' | 'month';
type ActiveTab = 'revenue' | 'refunds';

export default function AdminRevenue() {
  const { t } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<ActiveTab>('revenue');
  const { formatPrice } = useSystemSettings();

  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case '7d': return { start: subDays(now, 7), end: now };
      case '30d': return { start: subDays(now, 30), end: now };
      case '90d': return { start: subDays(now, 90), end: now };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      default: return { start: subDays(now, 30), end: now };
    }
  };

  const { start, end } = getDateRange();

  const { data: bookings = [] } = useQuery({
    queryKey: ['revenue-bookings', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, total_price, pickup_date, pickup_location, dropoff_location, driver_id, status, vehicle_name, discount_amount')
        .gte('pickup_date', format(start, 'yyyy-MM-dd'))
        .lte('pickup_date', format(end, 'yyyy-MM-dd'))
        .in('status', ['completed', 'confirmed']);
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, avatar_url, average_rating, total_rides, is_active');
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalCompleted = completedBookings.length;
  const avgBookingValue = totalCompleted > 0 ? totalRevenue / totalCompleted : 0;
  const totalDiscounts = bookings.reduce((sum, b) => sum + (b.discount_amount || 0), 0);

  const revenueByDay = eachDayOfInterval({ start, end }).map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayBookings = bookings.filter(b => b.pickup_date === dateStr);
    const revenue = dayBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
    return { date: format(date, 'MMM d'), revenue, bookings: dayBookings.length };
  });

  const revenueByVehicle = bookings.reduce((acc, b) => {
    const vehicle = b.vehicle_name || 'Unknown';
    if (!acc[vehicle]) acc[vehicle] = { name: vehicle, revenue: 0, count: 0 };
    acc[vehicle].revenue += b.total_price || 0;
    acc[vehicle].count += 1;
    return acc;
  }, {} as Record<string, { name: string; revenue: number; count: number }>);

  const vehicleChartData = Object.values(revenueByVehicle).sort((a, b) => b.revenue - a.revenue);

  const driverRevenue = bookings.reduce((acc, b) => {
    if (!b.driver_id) return acc;
    if (!acc[b.driver_id]) acc[b.driver_id] = { driverId: b.driver_id, revenue: 0, rides: 0 };
    acc[b.driver_id].revenue += b.total_price || 0;
    acc[b.driver_id].rides += 1;
    return acc;
  }, {} as Record<string, { driverId: string; revenue: number; rides: number }>);

  const topDrivers = Object.values(driverRevenue)
    .map(d => {
      const driver = drivers.find(dr => dr.id === d.driverId);
      return {
        ...d,
        name: driver ? `${driver.first_name} ${driver.last_name}` : 'Unknown',
        rating: driver?.average_rating || 0,
        avatar: driver?.avatar_url,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const maxDriverRevenue = topDrivers[0]?.revenue || 1;

  const COLORS = ['hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--muted))', '#8884d8'];

  const chartConfig = {
    revenue: { label: t.admin.revenue, color: 'hsl(var(--accent))' },
    bookings: { label: t.admin.bookings, color: 'hsl(var(--primary))' },
  };

  return (
    <AdminLayout
      title={t.admin.revenueAnalytics}
      description={t.admin.revenueDescription}
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="revenue" className="gap-2">
              <DollarSign className="h-4 w-4" />
              {t.admin.revenue}
            </TabsTrigger>
            <TabsTrigger value="refunds" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t.admin.refunds}
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'revenue' && (
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t.admin.last7Days}</SelectItem>
                <SelectItem value="30d">{t.admin.last30Days}</SelectItem>
                <SelectItem value="90d">{t.admin.last90Days}</SelectItem>
                <SelectItem value="month">{t.admin.thisMonthLabel}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="revenue" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.admin.totalRevenue}</CardTitle>
                <DollarSign className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  {format(start, 'MMM d')} - {format(end, 'MMM d')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.admin.completedRides}</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCompleted}</div>
                <p className="text-xs text-muted-foreground">
                  {bookings.length} {t.admin.totalBookingsLabel}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.admin.avgBookingValue}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(avgBookingValue)}</div>
                <p className="text-xs text-muted-foreground">{t.admin.perCompletedRide}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.admin.discountsApplied}</CardTitle>
                <Badge variant="secondary" className="text-xs">{t.admin.promo}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">-{formatPrice(totalDiscounts)}</div>
                <p className="text-xs text-muted-foreground">
                  {((totalDiscounts / (totalRevenue + totalDiscounts)) * 100).toFixed(1)}% {t.admin.ofGross}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t.admin.revenueOverTime}</CardTitle>
                <CardDescription>{t.admin.dailyRevenueDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueByDay}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#revenueGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.admin.revenueByVehicle}</CardTitle>
                <CardDescription>{t.admin.breakdownByVehicle}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vehicleChartData}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={90}
                        paddingAngle={2} dataKey="revenue" nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {vehicleChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatPrice(value), t.admin.revenue]} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.admin.bookingsByVehicle}</CardTitle>
                <CardDescription>{t.admin.rideCountPerVehicle}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vehicleChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t.admin.topDriverPerformance}
              </CardTitle>
              <CardDescription>{t.admin.driversRankedByRevenue}</CardDescription>
            </CardHeader>
            <CardContent>
              {topDrivers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.admin.noDriverData}
                </div>
              ) : (
                <div className="space-y-4">
                  {topDrivers.map((driver, index) => (
                    <div key={driver.driverId} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{driver.name}</span>
                            <Badge variant="outline" className="text-xs">
                              ⭐ {driver.rating?.toFixed(1) || '5.0'}
                            </Badge>
                          </div>
                          <span className="font-bold text-accent">{formatPrice(driver.revenue)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={(driver.revenue / maxDriverRevenue) * 100} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {driver.rides} {t.admin.rides}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refunds" className="mt-6">
          <RefundHistoryView />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}