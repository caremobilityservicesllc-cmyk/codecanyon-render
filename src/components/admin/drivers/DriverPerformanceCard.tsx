import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Star, TrendingUp, TrendingDown, Award, Target } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  average_rating: number;
  total_rides: number;
  earnings_total: number;
  earnings_this_month: number;
  completed_rides_this_month: number;
  is_active: boolean;
  documents_verified: boolean;
}

interface DriverPerformanceCardProps {
  drivers: Driver[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function DriverPerformanceCard({ drivers }: DriverPerformanceCardProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const dp = (t as any).driverPerformance || {};
  const topDriversByRating = useMemo(() => {
    return [...drivers]
      .filter(d => d.is_active && d.total_rides > 0)
      .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
      .slice(0, 5);
  }, [drivers]);

  const topDriversByRides = useMemo(() => {
    return [...drivers]
      .filter(d => d.is_active)
      .sort((a, b) => (b.completed_rides_this_month || 0) - (a.completed_rides_this_month || 0))
      .slice(0, 5);
  }, [drivers]);

  const topDriversByEarnings = useMemo(() => {
    return [...drivers]
      .filter(d => d.is_active)
      .sort((a, b) => (b.earnings_this_month || 0) - (a.earnings_this_month || 0))
      .slice(0, 5);
  }, [drivers]);

  const ratingDistribution = useMemo(() => {
    const distribution = [
      { range: '4.5-5.0', count: 0 },
      { range: '4.0-4.5', count: 0 },
      { range: '3.5-4.0', count: 0 },
      { range: '3.0-3.5', count: 0 },
      { range: '<3.0', count: 0 },
    ];

    drivers.forEach(d => {
      const rating = d.average_rating || 5;
      if (rating >= 4.5) distribution[0].count++;
      else if (rating >= 4) distribution[1].count++;
      else if (rating >= 3.5) distribution[2].count++;
      else if (rating >= 3) distribution[3].count++;
      else distribution[4].count++;
    });

    return distribution;
  }, [drivers]);

  const statusDistribution = useMemo(() => {
    const active = drivers.filter(d => d.is_active).length;
    const inactive = drivers.filter(d => !d.is_active).length;
    const verified = drivers.filter(d => d.documents_verified).length;
    const unverified = drivers.filter(d => !d.documents_verified).length;

    return [
      { name: 'Active', value: active },
      { name: 'Inactive', value: inactive },
    ];
  }, [drivers]);

  const totalStats = useMemo(() => {
    const totalRides = drivers.reduce((sum, d) => sum + (d.total_rides || 0), 0);
    const totalEarnings = drivers.reduce((sum, d) => sum + (d.earnings_total || 0), 0);
    const avgRating = drivers.length > 0
      ? drivers.reduce((sum, d) => sum + (d.average_rating || 5), 0) / drivers.length
      : 5;
    const monthlyRides = drivers.reduce((sum, d) => sum + (d.completed_rides_this_month || 0), 0);
    const monthlyEarnings = drivers.reduce((sum, d) => sum + (d.earnings_this_month || 0), 0);

    return { totalRides, totalEarnings, avgRating, monthlyRides, monthlyEarnings };
  }, [drivers]);

  const maxRidesThisMonth = Math.max(...drivers.map(d => d.completed_rides_this_month || 0), 1);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{dp.totalRides || 'Total Rides'}</p>
                <p className="text-2xl font-bold">{totalStats.totalRides.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalStats.monthlyRides} {dp.thisMonth || 'this month'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{dp.totalEarnings || 'Total Earnings'}</p>
                <p className="text-2xl font-bold">{formatPrice(totalStats.totalEarnings)}</p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatPrice(totalStats.monthlyEarnings)} {dp.thisMonth || 'this month'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{dp.averageRating || 'Average Rating'}</p>
                <p className="text-2xl font-bold">{totalStats.avgRating.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i < Math.round(totalStats.avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{dp.activeDrivers || 'Active Drivers'}</p>
                <p className="text-2xl font-bold">{statusDistribution[0].value}</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Award className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {statusDistribution[1].value} {dp.inactive || 'inactive'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Drivers by Rating */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              {dp.topRatedDrivers || 'Top Rated Drivers'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDriversByRating.map((driver, index) => (
                <div key={driver.id} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    #{index + 1}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={driver.avatar_url || undefined} />
                    <AvatarFallback>
                      {driver.first_name[0]}{driver.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {driver.first_name} {driver.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {driver.total_rides} {dp.rides || 'rides'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{driver.average_rating?.toFixed(2) || '5.00'}</span>
                  </div>
                </div>
              ))}
              {topDriversByRating.length === 0 && (
                <p className="text-center text-muted-foreground py-4">{dp.noDriversWithRatings || 'No drivers with ratings yet'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Drivers by Rides This Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {dp.mostActiveThisMonth || 'Most Active This Month'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDriversByRides.map((driver, index) => (
                <div key={driver.id} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    #{index + 1}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={driver.avatar_url || undefined} />
                    <AvatarFallback>
                      {driver.first_name[0]}{driver.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {driver.first_name} {driver.last_name}
                    </p>
                    <Progress 
                      value={(driver.completed_rides_this_month || 0) / maxRidesThisMonth * 100} 
                      className="h-2 mt-1" 
                    />
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{driver.completed_rides_this_month || 0}</p>
                    <p className="text-xs text-muted-foreground">{dp.rides || 'rides'}</p>
                  </div>
                </div>
              ))}
              {topDriversByRides.length === 0 && (
                <p className="text-center text-muted-foreground py-4">{dp.noRidesThisMonth || 'No rides this month'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{dp.ratingDistribution || 'Rating Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Driver Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{dp.driverStatus || 'Driver Status'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {statusDistribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Earners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-green-500" />
            {dp.topEarnersThisMonth || 'Top Earners This Month'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {topDriversByEarnings.map((driver, index) => (
              <Card key={driver.id} className={index === 0 ? 'border-yellow-500 bg-yellow-500/5' : ''}>
                <CardContent className="p-4 text-center">
                  {index === 0 && (
                    <Badge className="mb-2 bg-yellow-500 text-yellow-950">{dp.topEarner || '🏆 Top Earner'}</Badge>
                  )}
                  <Avatar className="h-12 w-12 mx-auto mb-2">
                    <AvatarImage src={driver.avatar_url || undefined} />
                    <AvatarFallback>
                      {driver.first_name[0]}{driver.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-sm">
                    {driver.first_name} {driver.last_name}
                  </p>
                  <p className="text-2xl font-bold text-green-500 mt-1">
                    {formatPrice(driver.earnings_this_month || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {driver.completed_rides_this_month || 0} {dp.rides || 'rides'}
                  </p>
                </CardContent>
              </Card>
            ))}
            {topDriversByEarnings.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-4">{dp.noEarningsData || 'No earnings data yet'}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
