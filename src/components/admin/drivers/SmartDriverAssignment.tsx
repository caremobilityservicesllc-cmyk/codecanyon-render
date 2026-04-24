import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Check, X, Star, MapPin, Clock, Zap, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_available: boolean | null;
  average_rating: number | null;
  total_rides: number | null;
  completed_rides_this_month: number | null;
  current_location_lat: number | null;
  current_location_lng: number | null;
}

interface SmartDriverAssignmentProps {
  bookingId: string;
  currentDriverId: string | null;
  pickupLat?: number;
  pickupLng?: number;
  onAssigned: (driverId: string | null, driverName: string | null) => void;
}

interface ScoredDriver extends Driver {
  score: number;
  ratingScore: number;
  availabilityScore: number;
  experienceScore: number;
  workloadScore: number;
  distanceKm?: number;
}

export function SmartDriverAssignment({ 
  bookingId, 
  currentDriverId,
  pickupLat,
  pickupLng,
  onAssigned 
}: SmartDriverAssignmentProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(currentDriverId || 'unassigned');
  const [isAssigning, setIsAssigning] = useState(false);
  const [useSmartAssignment, setUseSmartAssignment] = useState(true);
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['smart-available-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, avatar_url, is_available, average_rating, total_rides, completed_rides_this_month, current_location_lat, current_location_lng')
        .eq('is_active', true)
        .order('average_rating', { ascending: false });

      if (error) throw error;
      return data as Driver[];
    },
  });

  // Get today's assignments for workload balancing
  const { data: todayAssignments = [] } = useQuery({
    queryKey: ['today-driver-assignments'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('bookings')
        .select('driver_id')
        .eq('pickup_date', today)
        .not('driver_id', 'is', null);

      if (error) throw error;
      return data;
    },
  });

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Score and rank drivers
  const scoredDrivers: ScoredDriver[] = drivers.map(driver => {
    // Rating score (0-25 points)
    const ratingScore = ((driver.average_rating || 5) / 5) * 25;

    // Availability score (0-25 points)
    const availabilityScore = driver.is_available ? 25 : 0;

    // Experience score (0-25 points) - based on total rides
    const experienceScore = Math.min((driver.total_rides || 0) / 100, 1) * 25;

    // Workload score (0-25 points) - fewer assignments today = higher score
    const driverAssignmentsToday = todayAssignments.filter(a => a.driver_id === driver.id).length;
    const workloadScore = Math.max(0, 25 - (driverAssignmentsToday * 5));

    // Distance calculation if pickup coordinates are provided
    let distanceKm: number | undefined;
    if (pickupLat && pickupLng && driver.current_location_lat && driver.current_location_lng) {
      distanceKm = calculateDistance(
        pickupLat, 
        pickupLng, 
        driver.current_location_lat, 
        driver.current_location_lng
      );
    }

    const totalScore = ratingScore + availabilityScore + experienceScore + workloadScore;

    return {
      ...driver,
      score: totalScore,
      ratingScore,
      availabilityScore,
      experienceScore,
      workloadScore,
      distanceKm,
    };
  }).sort((a, b) => b.score - a.score);

  const recommendedDriver = scoredDrivers.find(d => d.is_available) || scoredDrivers[0];

  const handleAssign = async () => {
    setIsAssigning(true);
    try {
      const driverId = selectedDriverId === 'unassigned' ? null : selectedDriverId;
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          driver_id: driverId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;

      const driver = drivers.find(d => d.id === driverId);
      const driverName = driver ? `${driver.first_name} ${driver.last_name}` : null;
      
      queryClient.invalidateQueries({ queryKey: ['today-driver-assignments'] });
      onAssigned(driverId, driverName);
      toast.success(driverId ? t.driverAssignment.assignedSuccessfully : t.driverAssignment.unassigned);
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast.error(t.driverAssignment.failedToAssign);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAutoAssign = () => {
    if (recommendedDriver) {
      setSelectedDriverId(recommendedDriver.id);
      toast.info(t.driverAssignment.autoSelected.replace('{name}', `${recommendedDriver.first_name} ${recommendedDriver.last_name}`));
    }
  };

  const sa = (t as any).smartDriverAssign || {};

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{sa.loadingDrivers || 'Loading drivers...'}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Smart Assignment Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <Label htmlFor="smart-mode" className="text-sm font-medium">{sa.smartAssignment || 'Smart Assignment'}</Label>
        </div>
        <Switch
          id="smart-mode"
          checked={useSmartAssignment}
          onCheckedChange={setUseSmartAssignment}
        />
      </div>

      <Tabs defaultValue={useSmartAssignment ? "smart" : "manual"}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="smart" onClick={() => setUseSmartAssignment(true)}>
            <Zap className="h-4 w-4 mr-1" />
            {sa.smart || 'Smart'}
          </TabsTrigger>
          <TabsTrigger value="manual" onClick={() => setUseSmartAssignment(false)}>
            <User className="h-4 w-4 mr-1" />
            {sa.manual || 'Manual'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smart" className="space-y-3 mt-3">
          {/* Recommended Driver */}
          {recommendedDriver && (
            <Card className="border-primary bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Zap className="h-3 w-3 mr-1" />
                    {sa.recommended || 'Recommended'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={recommendedDriver.avatar_url || undefined} />
                    <AvatarFallback>
                      {recommendedDriver.first_name[0]}{recommendedDriver.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {recommendedDriver.first_name} {recommendedDriver.last_name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {recommendedDriver.average_rating?.toFixed(1) || '5.0'}
                      </span>
                      <span>{recommendedDriver.total_rides || 0} {sa.rides || 'rides'}</span>
                      {recommendedDriver.distanceKm && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {recommendedDriver.distanceKm.toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{recommendedDriver.score.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">{sa.score || 'score'}</p>
                  </div>
                </div>
                <Button 
                  className="w-full mt-3"
                  onClick={() => {
                    setSelectedDriverId(recommendedDriver.id);
                    handleAssign();
                  }}
                  disabled={isAssigning}
                >
                  {isAssigning ? (sa.assigningDriver || 'Assigning...') : (sa.assignRecommended || 'Assign Recommended Driver')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Score Breakdown for Top 3 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{sa.topCandidates || 'Top Candidates'}</p>
            {scoredDrivers.slice(0, 3).map((driver, index) => (
              <Card 
                key={driver.id} 
                className={`cursor-pointer transition-colors ${
                  selectedDriverId === driver.id ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedDriverId(driver.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={driver.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {driver.first_name[0]}{driver.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {driver.first_name} {driver.last_name}
                      </p>
                    </div>
                    {driver.is_available ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">{sa.available || 'Available'}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">{sa.busy || 'Busy'}</Badge>
                    )}
                    <span className="font-bold">{driver.score.toFixed(0)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">{sa.rating || 'Rating'}</span>
                        <span>{driver.ratingScore.toFixed(0)}/25</span>
                      </div>
                      <Progress value={(driver.ratingScore / 25) * 100} className="h-1" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">{sa.available || 'Available'}</span>
                        <span>{driver.availabilityScore.toFixed(0)}/25</span>
                      </div>
                      <Progress value={(driver.availabilityScore / 25) * 100} className="h-1" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">{sa.experience || 'Experience'}</span>
                        <span>{driver.experienceScore.toFixed(0)}/25</span>
                      </div>
                      <Progress value={(driver.experienceScore / 25) * 100} className="h-1" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">{sa.workload || 'Workload'}</span>
                        <span>{driver.workloadScore.toFixed(0)}/25</span>
                      </div>
                      <Progress value={(driver.workloadScore / 25) * 100} className="h-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="manual" className="space-y-3 mt-3">
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={sa.selectADriver || 'Select a driver'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-muted-foreground" />
                  <span>{sa.unassigned || 'Unassigned'}</span>
                </div>
              </SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={driver.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {driver.first_name[0]}{driver.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>{driver.first_name} {driver.last_name}</span>
                    <span className="text-xs text-muted-foreground">
                      ⭐ {driver.average_rating?.toFixed(1) || '5.0'}
                    </span>
                    {driver.is_available && (
                      <span className="ml-auto text-xs text-green-500">{sa.available || 'Available'}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleAssign} 
            disabled={isAssigning || selectedDriverId === (currentDriverId || 'unassigned')}
            className="w-full"
          >
            {isAssigning ? (sa.assigningDriver || 'Assigning...') : (sa.assignDriver || 'Assign Driver')}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
