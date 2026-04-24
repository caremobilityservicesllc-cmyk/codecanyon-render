import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DriverDocumentUpload } from './DriverDocumentUpload';
import {
  Star,
  Car,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  Shield,
  FileText,
  TrendingUp,
  MapPin,
} from 'lucide-react';

interface Driver {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  license_number: string;
  license_expiry: string;
  avatar_url: string | null;
  is_active: boolean;
  is_available: boolean;
  average_rating: number;
  total_rides: number;
  documents_verified: boolean;
  onboarding_status: string;
  background_check_status: string;
  earnings_total: number;
  earnings_this_month: number;
  completed_rides_this_month: number;
  created_at: string;
}

interface DriverDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver;
}

export function DriverDetailsSheet({ open, onOpenChange, driver }: DriverDetailsSheetProps) {
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const dd = (t as any).driverDetails || {};

  const { data: recentBookings = [] } = useQuery({
    queryKey: ['driver-recent-bookings', driver.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, booking_reference, pickup_location, dropoff_location, pickup_date, status, total_price')
        .eq('driver_id', driver.id)
        .order('pickup_date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['driver-ratings', driver.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_ratings')
        .select('id, rating, comment, created_at')
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{dd.approved || 'Approved'}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">{dd.pending || 'Pending'}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{dd.rejected || 'Rejected'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => r.rating === star).length,
    percentage: ratings.length > 0 ? (ratings.filter(r => r.rating === star).length / ratings.length) * 100 : 0,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={driver.avatar_url || undefined} />
              <AvatarFallback className="text-lg">
                {driver.first_name[0]}{driver.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-xl">
                {driver.first_name} {driver.last_name}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                {driver.documents_verified && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <Shield className="h-3 w-3 mr-1" />
                    {dd.verified || 'Verified'}
                  </Badge>
                )}
                {driver.is_active ? (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{dd.active || 'Active'}</Badge>
                ) : (
                  <Badge variant="outline">{dd.inactive || 'Inactive'}</Badge>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-lg font-bold">{driver.average_rating?.toFixed(1) || '5.0'}</span>
                </div>
                <p className="text-xs text-muted-foreground">{dd.rating || 'Rating'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-primary">
                  <Car className="h-4 w-4" />
                  <span className="text-lg font-bold">{driver.total_rides || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground">{dd.totalRides || 'Total Rides'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-green-500">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-lg font-bold">{formatPrice(driver.earnings_total || 0)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{dd.earnings || 'Earnings'}</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">{dd.contactInfo || 'Contact Information'}</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{driver.phone}</span>
              </div>
              {driver.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{driver.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{dd.joined || 'Joined'} {format(new Date(driver.created_at), 'MMM dd, yyyy')}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">{dd.licenseInfo || 'License Info'}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{dd.licenseHash || 'License #:'} {driver.license_number}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{dd.expiresLabel || 'Expires:'}</span>
                <span className="text-sm">{format(new Date(driver.license_expiry), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{dd.onboardingLabel || 'Onboarding:'}</span>
                {getStatusBadge(driver.onboarding_status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{dd.backgroundCheckLabel || 'Background Check:'}</span>
                {getStatusBadge(driver.background_check_status)}
              </div>
            </div>
          </div>

          <Separator />

          <DriverDocumentUpload 
            driverId={driver.id} 
            driverName={`${driver.first_name} ${driver.last_name}`} 
          />

          <Separator />

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {dd.thisMonth || 'This Month'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{driver.completed_rides_this_month || 0}</p>
                  <p className="text-xs text-muted-foreground">{dd.completedRides || 'Completed Rides'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-2xl font-bold">{formatPrice(driver.earnings_this_month || 0)}</p>
                  <p className="text-xs text-muted-foreground">{dd.earnings || 'Earnings'}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">{dd.ratingDistribution || 'Rating Distribution'}</h3>
            <div className="space-y-2">
              {ratingDistribution.map(({ star, count, percentage }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-sm w-8">{star} ⭐</span>
                  <Progress value={percentage} className="flex-1 h-2" />
                  <span className="text-sm text-muted-foreground w-8">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {ratings.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{dd.recentReviews || 'Recent Reviews'}</h3>
                <div className="space-y-3">
                  {ratings.slice(0, 3).map((rating) => (
                    <Card key={rating.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < rating.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(rating.created_at), 'MMM dd')}
                          </span>
                        </div>
                        {rating.comment && (
                          <p className="text-sm text-muted-foreground">{rating.comment}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {recentBookings.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{dd.recentBookings || 'Recent Bookings'}</h3>
                <div className="space-y-2">
                  {recentBookings.map((booking) => (
                    <Card key={booking.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{booking.booking_reference}</span>
                          <Badge variant="outline" className="text-xs">
                            {booking.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{booking.pickup_location}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(booking.pickup_date), 'MMM dd, yyyy')}
                          </span>
                          {booking.total_price && (
                            <span className="text-sm font-medium">${booking.total_price}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
