import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mail, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  email_type: string;
  provider: string;
  status: string;
  error_message: string | null;
  booking_reference: string | null;
  created_at: string;
}

export function EmailDeliveryLogs() {
  const { t } = useLanguage();
  const el = (t as any).emailLogs || {};

  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['email-delivery-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as EmailLog[];
    },
  });

  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              {el.title || 'Email Delivery Logs'}
            </CardTitle>
            <CardDescription>
              {el.description || 'Track sent emails and their delivery status'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            {el.refresh || 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{el.noEmailsSent || 'No emails sent yet'}</p>
            <p className="text-sm">{el.logsWillAppear || 'Email delivery logs will appear here'}</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{sentCount}</span>
                <span className="text-muted-foreground">{el.sent || 'sent'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium">{failedCount}</span>
                <span className="text-muted-foreground">{el.failed || 'failed'}</span>
              </div>
            </div>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{el.recipient || 'Recipient'}</TableHead>
                    <TableHead>{el.subject || 'Subject'}</TableHead>
                    <TableHead>{el.type || 'Type'}</TableHead>
                    <TableHead>{el.provider || 'Provider'}</TableHead>
                    <TableHead>{el.status || 'Status'}</TableHead>
                    <TableHead>{el.date || 'Date'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs max-w-[180px] truncate">
                        {log.recipient_email}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {log.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {log.email_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {log.provider}
                      </TableCell>
                      <TableCell>
                        {log.status === 'sent' ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {el.sentLabel || 'Sent'}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs" title={log.error_message || undefined}>
                            <XCircle className="h-3 w-3 mr-1" />
                            {el.failedLabel || 'Failed'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}