import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, FileWarning, Calendar, ChevronRight, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  license_expiry: string;
  insurance_expiry: string | null;
}

interface ExpiringItem {
  driverId: string;
  driverName: string;
  avatarUrl: string | null;
  documentType: 'license' | 'insurance' | 'document';
  documentName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

interface ExpiringDocumentsWidgetProps {
  drivers: Driver[];
}

export function ExpiringDocumentsWidget({ drivers }: ExpiringDocumentsWidgetProps) {
  const { t } = useLanguage();
  const ed = (t as any).expiringDocs || {};
  const du = (t as any).driverDocUpload || {};

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['expiring-driver-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_documents')
        .select('driver_id, document_type, expires_at, status')
        .not('expires_at', 'is', null)
        .eq('status', 'approved');
      if (error) throw error;
      return data;
    },
  });

  const expiringItems = useMemo(() => {
    const items: ExpiringItem[] = [];
    const today = new Date();
    const warningThresholdDays = 60;

    drivers.forEach(driver => {
      if (driver.license_expiry) {
        const expiryDate = new Date(driver.license_expiry);
        const daysUntilExpiry = differenceInDays(expiryDate, today);
        if (daysUntilExpiry <= warningThresholdDays) {
          items.push({
            driverId: driver.id,
            driverName: `${driver.first_name} ${driver.last_name}`,
            avatarUrl: driver.avatar_url,
            documentType: 'license',
            documentName: ed.driverLicense || 'Driver License',
            expiryDate,
            daysUntilExpiry,
          });
        }
      }

      if (driver.insurance_expiry) {
        const expiryDate = new Date(driver.insurance_expiry);
        const daysUntilExpiry = differenceInDays(expiryDate, today);
        if (daysUntilExpiry <= warningThresholdDays) {
          items.push({
            driverId: driver.id,
            driverName: `${driver.first_name} ${driver.last_name}`,
            avatarUrl: driver.avatar_url,
            documentType: 'insurance',
            documentName: du.insurance || 'Insurance',
            expiryDate,
            daysUntilExpiry,
          });
        }
      }
    });

    documents.forEach(doc => {
      if (doc.expires_at) {
        const expiryDate = new Date(doc.expires_at);
        const daysUntilExpiry = differenceInDays(expiryDate, today);
        const driver = drivers.find(d => d.id === doc.driver_id);
        if (daysUntilExpiry <= warningThresholdDays && driver) {
          items.push({
            driverId: doc.driver_id,
            driverName: `${driver.first_name} ${driver.last_name}`,
            avatarUrl: driver.avatar_url,
            documentType: 'document',
            documentName: formatDocumentType(doc.document_type, du),
            expiryDate,
            daysUntilExpiry,
          });
        }
      }
    });

    return items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [drivers, documents, ed, du]);

  const stats = useMemo(() => {
    const expired = expiringItems.filter(item => item.daysUntilExpiry < 0).length;
    const critical = expiringItems.filter(item => item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 7).length;
    const warning = expiringItems.filter(item => item.daysUntilExpiry > 7 && item.daysUntilExpiry <= 30).length;
    const upcoming = expiringItems.filter(item => item.daysUntilExpiry > 30).length;
    return { expired, critical, warning, upcoming, total: expiringItems.length };
  }, [expiringItems]);

  const getUrgencyBadge = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{ed.expired || 'Expired'}</Badge>;
    } else if (daysUntilExpiry <= 7) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{ed.critical || 'Critical'}</Badge>;
    } else if (daysUntilExpiry <= 30) {
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">{ed.soon || 'Soon'}</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">{ed.upcoming || 'Upcoming'}</Badge>;
  };

  const formatDaysRemaining = (days: number) => {
    if (days < 0) {
      return (ed.daysOverdue || '{count} days overdue').replace('{count}', String(Math.abs(days)));
    } else if (days === 0) {
      return ed.expiresToday || 'Expires today';
    } else if (days === 1) {
      return ed.oneDayLeft || '1 day left';
    }
    return (ed.daysLeft || '{count} days left').replace('{count}', String(days));
  };

  if (documentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-500" />
            {ed.title || 'Expiring Documents'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-500" />
            {ed.title || 'Expiring Documents'}
          </div>
          {stats.total > 0 && (
            <Badge variant="secondary" className="font-normal">
              {stats.total} {ed.items || 'items'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.expired}</p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">{ed.expired || 'Expired'}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.critical}</p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">≤7 days</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.warning}</p>
            <p className="text-xs text-orange-600/70 dark:text-orange-400/70">≤30 days</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.upcoming}</p>
            <p className="text-xs text-yellow-600/70 dark:text-yellow-400/70">≤60 days</p>
          </div>
        </div>

        {expiringItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{ed.noExpiring || 'No expiring documents in the next 60 days'}</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {expiringItems.map((item, index) => (
                <div
                  key={`${item.driverId}-${item.documentType}-${index}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    item.daysUntilExpiry < 0 
                      ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10' 
                      : item.daysUntilExpiry <= 7
                      ? 'border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/5'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={item.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {item.driverName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{item.driverName}</p>
                      {getUrgencyBadge(item.daysUntilExpiry)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.documentName} • {format(item.expiryDate, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-medium ${
                      item.daysUntilExpiry < 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : item.daysUntilExpiry <= 7
                        ? 'text-red-600 dark:text-red-400'
                        : item.daysUntilExpiry <= 30
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {formatDaysRemaining(item.daysUntilExpiry)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function formatDocumentType(type: string, du: any): string {
  const typeMap: Record<string, string> = {
    license_front: du.licenseFront || 'License (Front)',
    license_back: du.licenseBack || 'License (Back)',
    vehicle_registration: du.vehicleRegistration || 'Vehicle Registration',
    insurance: du.insurance || 'Insurance',
    background_check: du.backgroundCheck || 'Background Check',
    profile_photo: 'Profile Photo',
  };
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
