import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileCheck, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export function PendingDocumentsWidget() {
  const { t } = useLanguage();
  const pd = (t as any).pendingDocs || {};

  const { data, isLoading } = useQuery({
    queryKey: ['pending-documents-count'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('driver_documents')
        .select('id, uploaded_at', { count: 'exact' })
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: true })
        .limit(1);

      if (error) throw error;

      const oldestUpload = data?.[0]?.uploaded_at;
      let daysWaiting = 0;
      if (oldestUpload) {
        daysWaiting = Math.floor(
          (Date.now() - new Date(oldestUpload).getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      return {
        count: count || 0,
        daysWaiting,
      };
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-20 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const pendingCount = data?.count || 0;
  const daysWaiting = data?.daysWaiting || 0;
  const isUrgent = daysWaiting >= 3;
  const unit = daysWaiting === 1 ? (pd.day || 'day') : (pd.days || 'days');

  return (
    <Card className={isUrgent && pendingCount > 0 ? 'border-destructive/50' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-primary" />
          {pd.title || 'Pending Documents'}
        </CardTitle>
        {pendingCount > 0 && (
          <Badge variant={isUrgent ? 'destructive' : 'secondary'} className="text-xs">
            {isUrgent ? (pd.urgent || 'Urgent') : (pd.needsReview || 'Needs Review')}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-bold">{pendingCount}</div>
            {pendingCount > 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {isUrgent ? (
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {(pd.oldestWaiting || 'Oldest waiting {count} {unit}').replace('{count}', String(daysWaiting)).replace('{unit}', unit)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{pd.allReviewed || 'All documents reviewed'}</p>
            )}
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/admin/document-review">
              {pd.review || 'Review'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}