import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw, 
  Brain, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface HourlyPrediction {
  hour: number;
  displayTime: string;
  predictedLevel: 'low' | 'moderate' | 'heavy' | 'severe';
  confidence: number;
  predictedBookings: number;
  factors: string[];
}

interface ZonePrediction {
  zoneId: string;
  zoneName: string;
  hourlyPredictions: HourlyPrediction[];
  peakHours: number[];
  avgCongestionScore: number;
}

interface PredictionResponse {
  generatedAt: string;
  forecastPeriod: {
    start: string;
    end: string;
  };
  overallTrend: 'improving' | 'stable' | 'worsening';
  zones: ZonePrediction[];
  insights: string[];
  modelConfidence: number;
}

const TRAFFIC_COLORS = {
  low: 'bg-green-500',
  moderate: 'bg-yellow-500',
  heavy: 'bg-orange-500',
  severe: 'bg-red-500',
};

const TRAFFIC_TEXT = {
  low: 'text-green-600 dark:text-green-400',
  moderate: 'text-yellow-600 dark:text-yellow-400',
  heavy: 'text-orange-600 dark:text-orange-400',
  severe: 'text-red-600 dark:text-red-400',
};

export function TrafficForecastWidget() {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useLanguage();
  const tf = (t as any).trafficForecast || {};

  const { data: predictions, isLoading, refetch } = useQuery({
    queryKey: ['traffic-predictions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('predict-traffic');
      if (error) throw error;
      return data as PredictionResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes
  });

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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'worsening': return <TrendingUp className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'improving': return { text: tf.improving || 'Improving', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'worsening': return { text: tf.worsening || 'Worsening', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
      default: return { text: tf.stable || 'Stable', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
    }
  };

  const currentHour = new Date().getHours();
  
  // Filter zones based on selection
  const displayedZones = selectedZone === 'all' 
    ? predictions?.zones || []
    : predictions?.zones?.filter(z => z.zoneId === selectedZone) || [];

  // Get next 24 hours starting from current hour
  const getNext24Hours = (predictions: HourlyPrediction[]) => {
    const reordered: HourlyPrediction[] = [];
    for (let i = 0; i < 24; i++) {
      const hour = (currentHour + i) % 24;
      const prediction = predictions.find(p => p.hour === hour);
      if (prediction) reordered.push(prediction);
    }
    return reordered;
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {tf.title || '24-Hour Traffic Forecast'}
                <Sparkles className="h-4 w-4 text-primary" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {tf.subtitle || 'AI-powered congestion predictions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={tf.selectZone || 'Select zone'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tf.allZones || 'All Zones'}</SelectItem>
                {predictions?.zones?.map(zone => (
                  <SelectItem key={zone.zoneId} value={zone.zoneId}>
                    {zone.zoneName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", (isRefreshing || isLoading) && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">{tf.generatingPredictions || 'Generating predictions...'}</p>
            </div>
          </div>
        ) : predictions ? (
          <>
            {/* Overview Stats */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/20">
                  {getTrendIcon(predictions.overallTrend)}
                </div>
                <div>
                  <Badge className={getTrendLabel(predictions.overallTrend).color}>
                    {getTrendLabel(predictions.overallTrend).text}
                  </Badge>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{tf.overallTrend || 'Overall Trend'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-500/20">
                  <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {Math.round(predictions.modelConfidence * 100)}%
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{tf.modelConfidence || 'Model Confidence'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-orange-500/20">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {predictions.zones.reduce((sum, z) => sum + z.peakHours.length, 0)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{tf.peakHourWindows || 'Peak Hour Windows'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-500/20">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(predictions.generatedAt), 'h:mm a')}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{tf.lastUpdated || 'Last Updated'}</p>
                </div>
              </div>
            </div>

            {/* AI Insights */}
            {predictions.insights.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{tf.aiInsights || 'AI Insights'}</span>
                </div>
                <ul className="space-y-2">
                  {predictions.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Forecast Timeline */}
            {displayedZones.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">{tf.hourlyForecast || 'Hourly Forecast (Next 24 Hours)'}</h3>
                
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Hour labels */}
                    <div className="mb-2 ml-28 flex gap-0.5">
                      {Array.from({ length: 24 }, (_, i) => (currentHour + i) % 24)
                        .filter((_, i) => i % 2 === 0)
                        .map(hour => (
                          <div
                            key={hour}
                            className={cn(
                              "flex-1 text-center text-[10px]",
                              hour === currentHour ? "font-bold text-primary" : "text-muted-foreground"
                            )}
                            style={{ minWidth: '24px' }}
                          >
                            {formatHour(hour)}
                          </div>
                        ))}
                    </div>

                    {/* Zone rows */}
                    <div className="space-y-1">
                      {displayedZones.map(zone => {
                        const orderedPredictions = getNext24Hours(zone.hourlyPredictions);
                        
                        return (
                          <div key={zone.zoneId} className="flex items-center gap-2">
                            <div className="w-24 truncate text-right text-xs font-medium text-foreground">
                              {zone.zoneName}
                            </div>
                            <div className="flex flex-1 gap-0.5">
                              {orderedPredictions.map((prediction, idx) => (
                                <div
                                  key={`${zone.zoneId}-${prediction.hour}`}
                                  className={cn(
                                    "group relative h-8 flex-1 rounded-sm transition-all hover:ring-2 hover:ring-primary hover:ring-offset-1",
                                    TRAFFIC_COLORS[prediction.predictedLevel],
                                    prediction.predictedLevel === 'low' && 'opacity-50',
                                    prediction.predictedLevel === 'moderate' && 'opacity-70',
                                    prediction.predictedLevel === 'heavy' && 'opacity-85',
                                    idx === 0 && 'ring-2 ring-primary ring-offset-1'
                                  )}
                                  style={{ minWidth: '12px' }}
                                >
                                  {/* Tooltip */}
                                  <div className="absolute -top-24 left-1/2 z-50 hidden -translate-x-1/2 group-hover:block">
                                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg min-w-[140px]">
                                      <p className="font-semibold text-popover-foreground">{zone.zoneName}</p>
                                      <p className="text-muted-foreground">{prediction.displayTime}</p>
                                      <div className="mt-1 flex items-center gap-1">
                                        <span className={cn("h-2 w-2 rounded-full", TRAFFIC_COLORS[prediction.predictedLevel])} />
                                        <span className={TRAFFIC_TEXT[prediction.predictedLevel]}>
                                          {prediction.predictedLevel.charAt(0).toUpperCase() + prediction.predictedLevel.slice(1)}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-muted-foreground">
                                        ~{prediction.predictedBookings} {tf.bookings || 'bookings'}
                                      </p>
                                      <p className="text-muted-foreground">
                                        {Math.round(prediction.confidence * 100)}% {tf.confidence || 'confidence'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 xs:flex xs:flex-wrap xs:items-center xs:gap-x-4 xs:gap-y-2">
                    <span className="text-xs font-medium text-muted-foreground col-span-2 xs:col-auto">{(tf as any).trafficLevelLabel || ((t as any).trafficForecastLegend?.trafficLevel) || 'Traffic Level:'}</span>
                    {Object.entries(TRAFFIC_COLORS).map(([level, color]) => (
                      <div key={level} className="flex items-center gap-1.5">
                        <div className={cn("h-3 w-3 rounded-full flex-shrink-0", color)} />
                        <span className="text-xs text-muted-foreground capitalize">{level}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{(tf as any).peakHoursLabel || ((t as any).trafficForecastLegend?.peakHours) || 'Peak Hours:'}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm ring-2 ring-primary ring-offset-1 bg-muted flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{tf.currentHour || 'Current Hour'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Brain className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{tf.noZoneData || 'No zone data available'}</p>
                <p className="text-xs text-muted-foreground">{tf.configureZonesHint || 'Configure zones to see traffic predictions'}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{tf.unableToLoad || 'Unable to load predictions'}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
              {tf.tryAgain || 'Try Again'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
