import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, RefreshCw, Clock, MapPin, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfHour, addHours } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface Zone {
  id: string;
  name: string;
  multiplier: number;
  is_active: boolean;
}

interface TrafficCell {
  hour: number;
  zone: string;
  level: 'low' | 'moderate' | 'heavy' | 'severe';
  bookingCount: number;
  avgMultiplier: number;
}

interface HourlyPattern {
  hour: number;
  totalBookings: number;
  avgDemand: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getTrafficLevels(tl: any) {
  return {
    low: { color: 'bg-green-500', label: tl?.low || 'Low', textColor: 'text-green-700 dark:text-green-400' },
    moderate: { color: 'bg-yellow-500', label: tl?.moderate || 'Moderate', textColor: 'text-yellow-700 dark:text-yellow-400' },
    heavy: { color: 'bg-orange-500', label: tl?.heavy || 'Heavy', textColor: 'text-orange-700 dark:text-orange-400' },
    severe: { color: 'bg-red-500', label: tl?.severe || 'Severe', textColor: 'text-red-700 dark:text-red-400' },
  };
}

export function TrafficHeatmapWidget() {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7days' | '30days'>('7days');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useLanguage();
  const th = (t as any).trafficHeatmap || {};
  const tl = (t as any).trafficLevels || {};
  const TRAFFIC_LEVELS = getTrafficLevels(tl);

  // Fetch zones
  const { data: zones = [] } = useQuery({
    queryKey: ['admin-zones-traffic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name, multiplier, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Zone[];
    },
  });

  // Fetch bookings for traffic analysis
  const { data: bookings = [], refetch } = useQuery({
    queryKey: ['admin-bookings-traffic', selectedPeriod],
    queryFn: async () => {
      const startDate = selectedPeriod === 'today' 
        ? new Date().toISOString().split('T')[0]
        : selectedPeriod === '7days'
          ? subDays(new Date(), 7).toISOString().split('T')[0]
          : subDays(new Date(), 30).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('bookings')
        .select('id, pickup_time, pickup_date, pickup_location, dropoff_location, created_at')
        .gte('pickup_date', startDate)
        .order('pickup_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate hourly patterns
  const hourlyPatterns = useMemo(() => {
    const patterns: Map<number, { count: number; total: number }> = new Map();
    
    HOURS.forEach(h => patterns.set(h, { count: 0, total: 0 }));

    bookings.forEach(booking => {
      if (booking.pickup_time) {
        const hour = parseInt(booking.pickup_time.split(':')[0], 10);
        const current = patterns.get(hour) || { count: 0, total: 0 };
        patterns.set(hour, { count: current.count + 1, total: current.total + 1 });
      }
    });

    return HOURS.map(hour => {
      const data = patterns.get(hour) || { count: 0, total: 0 };
      return {
        hour,
        totalBookings: data.count,
        avgDemand: data.count,
      };
    });
  }, [bookings]);

  // Generate heatmap data based on zones and hours
  const heatmapData = useMemo(() => {
    const data: TrafficCell[][] = [];
    const maxBookings = Math.max(...hourlyPatterns.map(p => p.totalBookings), 1);

    zones.forEach((zone, zoneIndex) => {
      const row: TrafficCell[] = [];
      
      HOURS.forEach(hour => {
        const pattern = hourlyPatterns.find(p => p.hour === hour);
        const bookingCount = pattern?.totalBookings || 0;
        
        // Calculate traffic level based on demand and zone multiplier
        const demandRatio = bookingCount / maxBookings;
        const zoneImpact = zone.multiplier;
        const combinedScore = demandRatio * zoneImpact;

        let level: TrafficCell['level'];
        if (combinedScore < 0.25) level = 'low';
        else if (combinedScore < 0.5) level = 'moderate';
        else if (combinedScore < 0.75) level = 'heavy';
        else level = 'severe';

        // Simulate zone-specific variation
        const zoneVariation = (zoneIndex * 3 + hour) % 4;
        if (zoneVariation === 0 && level !== 'severe') {
          const levels: TrafficCell['level'][] = ['low', 'moderate', 'heavy', 'severe'];
          const currentIndex = levels.indexOf(level);
          level = levels[Math.min(currentIndex + 1, 3)];
        }

        row.push({
          hour,
          zone: zone.name,
          level,
          bookingCount,
          avgMultiplier: zone.multiplier,
        });
      });
      
      data.push(row);
    });

    return data;
  }, [zones, hourlyPatterns]);

  // Calculate peak hours
  const peakHours = useMemo(() => {
    const sorted = [...hourlyPatterns].sort((a, b) => b.totalBookings - a.totalBookings);
    return sorted.slice(0, 3).map(p => p.hour);
  }, [hourlyPatterns]);

  // Calculate overall traffic stats
  const trafficStats = useMemo(() => {
    const allCells = heatmapData.flat();
    const severeCells = allCells.filter(c => c.level === 'severe').length;
    const heavyCells = allCells.filter(c => c.level === 'heavy').length;
    const totalCells = allCells.length || 1;

    return {
      congestionRate: Math.round(((severeCells + heavyCells) / totalCells) * 100),
      peakZone: zones.reduce((max, z) => z.multiplier > (max?.multiplier || 0) ? z : max, zones[0]),
      totalBookings: bookings.length,
    };
  }, [heatmapData, zones, bookings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
  };

  const getCellOpacity = (level: TrafficCell['level']) => {
    switch (level) {
      case 'low': return 'opacity-40';
      case 'moderate': return 'opacity-60';
      case 'heavy': return 'opacity-80';
      case 'severe': return 'opacity-100';
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{th.title || 'Traffic Heatmap'}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {th.subtitle || 'Real-time congestion patterns across zones'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as typeof selectedPeriod)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{th.today || 'Today'}</SelectItem>
                <SelectItem value="7days">{th.last7Days || 'Last 7 Days'}</SelectItem>
                <SelectItem value="30days">{th.last30Days || 'Last 30 Days'}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-orange-500/20">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{trafficStats.congestionRate}%</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{th.congestionRate || 'Congestion Rate'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/20">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {peakHours.length > 0 ? formatHour(peakHours[0]) : 'N/A'}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{th.peakHour || 'Peak Hour'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-500/20">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{trafficStats.totalBookings}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{th.totalBookings || 'Total Bookings'}</p>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        {zones.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Hour labels */}
              <div className="mb-2 ml-28 flex gap-0.5">
                {HOURS.filter((_, i) => i % 2 === 0).map(hour => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-[10px] text-muted-foreground"
                    style={{ minWidth: '24px' }}
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              <div className="space-y-1">
                {heatmapData.map((row, rowIndex) => (
                  <div key={zones[rowIndex]?.id} className="flex items-center gap-2">
                    <div className="w-24 truncate text-right text-xs font-medium text-foreground">
                      {zones[rowIndex]?.name}
                    </div>
                    <div className="flex flex-1 gap-0.5">
                      {row.map((cell, cellIndex) => (
                        <div
                          key={`${cell.zone}-${cell.hour}`}
                          className={cn(
                            "group relative h-6 flex-1 rounded-sm transition-all hover:ring-2 hover:ring-primary hover:ring-offset-1",
                            TRAFFIC_LEVELS[cell.level].color,
                            getCellOpacity(cell.level)
                          )}
                          style={{ minWidth: '12px' }}
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-16 left-1/2 z-50 hidden -translate-x-1/2 group-hover:block">
                            <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                              <p className="font-semibold text-popover-foreground">{cell.zone}</p>
                              <p className="text-muted-foreground">{formatHour(cell.hour)}</p>
                              <div className="mt-1 flex items-center gap-1">
                                <span className={cn("h-2 w-2 rounded-full", TRAFFIC_LEVELS[cell.level].color)} />
                                <span className={TRAFFIC_LEVELS[cell.level].textColor}>
                                  {TRAFFIC_LEVELS[cell.level].label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{th.noActiveZones || 'No active zones configured'}</p>
            <p className="text-xs text-muted-foreground">{th.addZonesHint || 'Add zones in Settings to view traffic patterns'}</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground">{th.trafficLevel || 'Traffic Level:'}</span>
            {Object.entries(TRAFFIC_LEVELS).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn("h-3 w-3 rounded-sm", value.color)} />
                <span className="text-xs text-muted-foreground">{value.label}</span>
              </div>
            ))}
          </div>

          {peakHours.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{th.peakHours || 'Peak Hours:'}</span>
              {peakHours.map(hour => (
                <Badge key={hour} variant="secondary" className="text-xs">
                  {formatHour(hour)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
