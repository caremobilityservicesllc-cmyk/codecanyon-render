import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  RefreshCw, 
  Car, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  MapPin,
  Clock,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

interface ZoneDeployment {
  zoneId: string;
  zoneName: string;
  currentDrivers: number;
  recommendedDrivers: number;
  demandScore: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  action: 'maintain' | 'increase' | 'decrease' | 'urgent-increase';
  reasoning: string;
}

interface HourlyRecommendation {
  hour: number;
  displayTime: string;
  totalDemand: number;
  totalDriversNeeded: number;
  zones: ZoneDeployment[];
}

interface DeploymentResponse {
  generatedAt: string;
  forecastPeriod: { start: string; end: string };
  currentStatus: {
    totalDrivers: number;
    availableDrivers: number;
    activeRides: number;
    utilizationRate: number;
  };
  hourlyRecommendations: HourlyRecommendation[];
  immediateActions: { action: string; priority: 'high' | 'medium' | 'low'; zone?: string }[];
  insights: string[];
  modelConfidence: number;
}

const URGENCY_COLORS = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_COLORS = {
  low: 'border-green-500/30 bg-green-500/5',
  medium: 'border-yellow-500/30 bg-yellow-500/5',
  high: 'border-red-500/30 bg-red-500/5',
};

export function DriverDeploymentWidget() {
  const [selectedHour, setSelectedHour] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useLanguage();
  const dd = (t as any).driverDeployment || {};

  const { data: deployment, isLoading, refetch } = useQuery({
    queryKey: ['driver-deployment-predictions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('predict-driver-deployment');
      if (error) throw error;
      return data as DeploymentResponse;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'increase':
      case 'urgent-increase':
        return <ArrowUp className="h-3 w-3" />;
      case 'decrease':
        return <ArrowDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const currentRecommendation = deployment?.hourlyRecommendations[selectedHour];

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {dd.title || 'Driver Deployment Optimizer'}
                <Sparkles className="h-4 w-4 text-blue-500" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {dd.subtitle || 'AI-powered staffing recommendations'}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", (isRefreshing || isLoading) && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">{dd.analyzing || 'Analyzing deployment needs...'}</p>
            </div>
          </div>
        ) : deployment ? (
          <>
            {/* Current Status */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-500/20">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{deployment.currentStatus.totalDrivers}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{dd.totalDrivers || 'Total Drivers'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-500/20">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{deployment.currentStatus.availableDrivers}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{dd.available || 'Available'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/20">
                  <Car className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{deployment.currentStatus.activeRides}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{dd.activeRides || 'Active Rides'}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{dd.utilization || 'Utilization'}</span>
                  <span className="text-xs sm:text-sm font-bold text-foreground">{deployment.currentStatus.utilizationRate}%</span>
                </div>
                <Progress value={deployment.currentStatus.utilizationRate} className="h-2" />
              </div>
            </div>

            {/* Immediate Actions */}
            {deployment.immediateActions.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  {dd.immediateActions || 'Immediate Actions Required'}
                </h3>
                <div className="grid gap-2">
                  {deployment.immediateActions.map((action, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        PRIORITY_COLORS[action.priority]
                      )}
                    >
                      <Badge variant="outline" className={cn("shrink-0", URGENCY_COLORS[action.priority === 'high' ? 'critical' : action.priority])}>
                        {action.priority}
                      </Badge>
                      <p className="text-sm text-foreground">{action.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hourly Timeline */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                {dd.hourForecast || '12-Hour Forecast'}
              </h3>
              
              <div className="flex gap-1 overflow-x-auto pb-2">
                {deployment.hourlyRecommendations.map((rec, idx) => {
                  const hasUrgent = rec.zones.some(z => z.urgency === 'critical' || z.urgency === 'high');
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedHour(idx)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-all min-w-[60px]",
                        idx === selectedHour 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover:bg-muted/50",
                        hasUrgent && idx !== selectedHour && "border-orange-500/50"
                      )}
                    >
                      <span className={cn(
                        "text-xs font-medium",
                        idx === selectedHour ? "text-primary" : "text-muted-foreground"
                      )}>
                        {rec.displayTime}
                      </span>
                      <span className="text-lg font-bold text-foreground">{rec.totalDriversNeeded}</span>
                      <span className="text-[10px] text-muted-foreground">{dd.drivers || 'drivers'}</span>
                      {hasUrgent && (
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Zone Breakdown for Selected Hour */}
            {currentRecommendation && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {(dd.zoneBreakdown || 'Zone Breakdown for {time}').replace('{time}', currentRecommendation.displayTime)}
                </h3>
                
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {currentRecommendation.zones.map(zone => (
                    <div
                      key={zone.zoneId}
                      className="rounded-lg border border-border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{zone.zoneName}</span>
                        <Badge className={URGENCY_COLORS[zone.urgency]}>
                          {zone.urgency}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{dd.current || 'Current:'}</span>
                          <span className="font-medium text-foreground">{zone.currentDrivers}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {getActionIcon(zone.action)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{dd.needed || 'Needed:'}</span>
                          <span className={cn(
                            "font-medium",
                            zone.recommendedDrivers > zone.currentDrivers 
                              ? "text-orange-500" 
                              : zone.recommendedDrivers < zone.currentDrivers 
                                ? "text-green-500" 
                                : "text-foreground"
                          )}>
                            {zone.recommendedDrivers}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{dd.demandScore || 'Demand Score'}</span>
                          <span className="text-muted-foreground">{zone.demandScore}%</span>
                        </div>
                        <Progress value={zone.demandScore} className="h-1.5" />
                      </div>

                      <p className="text-xs text-muted-foreground">{zone.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
            {deployment.insights.length > 0 && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-foreground">{dd.aiInsights || 'AI Insights'}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {Math.round(deployment.modelConfidence * 100)}% {dd.confidence || 'confidence'}
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {deployment.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span>{dd.lastUpdated || 'Last updated:'} {format(new Date(deployment.generatedAt), 'h:mm a')}</span>
              <span>{dd.forecastPeriod || 'Forecast period: Next 12 hours'}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{dd.unableToLoad || 'Unable to load deployment predictions'}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
              {dd.tryAgain || 'Try Again'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
