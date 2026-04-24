import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  RotateCcw, 
  Search, 
  CreditCard, 
  Wallet, 
  Building, 
  
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  DollarSign,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
interface RefundEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  setting_key: string;
  old_value: Record<string, unknown> | null;
  new_value: {
    booking_reference?: string;
    payment_method?: string;
    amount?: number;
    refund_id?: string;
    reason?: string;
  } | null;
  action: string;
  created_at: string;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  card: <CreditCard className="h-4 w-4" />,
  stripe: <CreditCard className="h-4 w-4" />,
  paypal: <Wallet className="h-4 w-4" />,
  bank: <Building className="h-4 w-4" />,
  bank_transfer: <Building className="h-4 w-4" />,
};

function usePaymentMethodLabels() {
  const { t } = useLanguage();
  const pm = (t as any).paymentMethodLabels || {};
  return {
    card: pm.creditCardStripe || 'Credit Card (Stripe)',
    stripe: pm.stripe || 'Stripe',
    paypal: pm.paypal || 'PayPal',
    bank: pm.bankTransfer || 'Bank Transfer',
    bank_transfer: pm.bankTransfer || 'Bank Transfer',
  } as Record<string, string>;
}

export function RefundHistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState<string>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const { formatPrice } = useSystemSettings();
  const { t } = useLanguage();
  const rh = (t as any).refundHistory || {};
  const PAYMENT_METHOD_LABELS = usePaymentMethodLabels();

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ['refund-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_audit_log')
        .select('*')
        .eq('setting_key', 'refund_processed')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as RefundEntry[];
    },
  });

  // Calculate summary stats
  const stats = refunds.reduce(
    (acc, refund) => {
      const amount = refund.new_value?.amount || 0;
      const method = refund.new_value?.payment_method || 'unknown';
      
      acc.totalAmount += amount;
      acc.totalCount += 1;
      acc.byGateway[method] = (acc.byGateway[method] || 0) + amount;
      acc.countByGateway[method] = (acc.countByGateway[method] || 0) + 1;
      
      return acc;
    },
    { 
      totalAmount: 0, 
      totalCount: 0, 
      byGateway: {} as Record<string, number>,
      countByGateway: {} as Record<string, number>
    }
  );

  // Filter refunds
  const filteredRefunds = refunds.filter((refund) => {
    const matchesSearch =
      refund.new_value?.booking_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      refund.new_value?.refund_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      refund.user_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGateway = gatewayFilter === 'all' || refund.new_value?.payment_method === gatewayFilter;
    
    return matchesSearch && matchesGateway;
  });

  const getStatusBadge = (refundId?: string) => {
    if (!refundId) return null;
    
    if (refundId.includes('pending') || refundId.includes('BANK')) {
      return (
        <Badge variant="outline" className="gap-1 border-warning text-warning">
          <Clock className="h-3 w-3" />
          {rh.manualProcessing || 'Manual Processing'}
        </Badge>
      );
    }
    
    if (refundId.includes('demo') || refundId.includes('DEMO')) {
      return (
        <Badge variant="outline" className="gap-1 border-primary text-primary">
          <AlertCircle className="h-3 w-3" />
          {rh.testModeLabel || 'Test Mode'}
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="gap-1 border-accent text-accent">
        <CheckCircle className="h-3 w-3" />
        {rh.processed || 'Processed'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            {rh.title || 'Refund History'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{rh.totalRefunded || 'Total Refunded'}</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatPrice(stats.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(rh.acrossRefunds || 'Across {count} refunds').replace('{count}', String(stats.totalCount))}
            </p>
          </CardContent>
        </Card>

        {Object.entries(stats.byGateway).map(([gateway, amount]) => (
          <Card key={gateway}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {PAYMENT_METHOD_ICONS[gateway]}
                {PAYMENT_METHOD_LABELS[gateway] || gateway}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(amount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.countByGateway[gateway]} refund{stats.countByGateway[gateway] !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Refund List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            {rh.title || 'Refund History'}
          </CardTitle>
          <CardDescription>
            {rh.description || 'Track all processed refunds across payment gateways'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={rh.searchPlaceholder || 'Search by booking reference, refund ID, or admin email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
            <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={rh.filterByGateway || 'Filter by gateway'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{rh.allGateways || 'All Gateways'}</SelectItem>
                <SelectItem value="card">{PAYMENT_METHOD_LABELS.card}</SelectItem>
                <SelectItem value="paypal">{PAYMENT_METHOD_LABELS.paypal}</SelectItem>
                <SelectItem value="bank">{PAYMENT_METHOD_LABELS.bank}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredRefunds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{rh.noRefundsRecorded || 'No refunds recorded'}</p>
              <p className="text-sm">{rh.refundsWillAppear || 'Refunds will appear here when processed'}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{rh.dateColumn || 'Date'}</TableHead>
                      <TableHead>{rh.bookingReference || 'Booking Reference'}</TableHead>
                      <TableHead>{rh.gateway || 'Gateway'}</TableHead>
                      <TableHead>{rh.amountColumn || 'Amount'}</TableHead>
                      <TableHead>{rh.statusColumn || 'Status'}</TableHead>
                      <TableHead>{rh.processedBy || 'Processed By'}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRefunds.map((refund) => (
                      <Collapsible
                        key={refund.id}
                        open={expandedEntry === refund.id}
                        onOpenChange={(open) => setExpandedEntry(open ? refund.id : null)}
                        asChild
                      >
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">
                              {format(new Date(refund.created_at), 'MMM d, yyyy')}
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(refund.created_at), 'h:mm a')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="rounded bg-muted px-2 py-1 text-sm">
                                {refund.new_value?.booking_reference || 'N/A'}
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {PAYMENT_METHOD_ICONS[refund.new_value?.payment_method || '']}
                                <span>
                                  {PAYMENT_METHOD_LABELS[refund.new_value?.payment_method || ''] || (rh.unknown || 'Unknown')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold text-destructive">
                              -{formatPrice(refund.new_value?.amount || 0)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(refund.new_value?.refund_id)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm truncate max-w-[150px]">
                                  {refund.user_email || (rh.system || 'System')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  {expandedEntry === refund.id ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={7} className="p-4">
                                <div className="grid gap-4 md:grid-cols-3">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">{rh.refundId || 'Refund ID'}</p>
                                    <code className="text-sm break-all">
                                      {refund.new_value?.refund_id || 'N/A'}
                                    </code>
                                  </div>
                                  {refund.new_value?.reason && (
                                    <div className="md:col-span-2">
                                      <p className="text-xs text-muted-foreground mb-1">{rh.reason || 'Reason'}</p>
                                      <p className="text-sm">{refund.new_value.reason}</p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredRefunds.map((refund) => (
                      <Collapsible
                        key={refund.id}
                        open={expandedEntry === refund.id}
                        onOpenChange={(open) => setExpandedEntry(open ? refund.id : null)}
                      >
                        <div className="rounded-lg border bg-card p-4">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-between p-0 h-auto hover:bg-transparent"
                            >
                              <div className="flex flex-col items-start gap-2 text-left w-full">
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    {PAYMENT_METHOD_ICONS[refund.new_value?.payment_method || '']}
                                    <code className="text-sm font-mono">
                                      {refund.new_value?.booking_reference || 'N/A'}
                                    </code>
                                  </div>
                                  <span className="font-bold text-destructive">
                                    -{formatPrice(refund.new_value?.amount || 0)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(refund.created_at), 'MMM d, yyyy h:mm a')}
                                  </div>
                                  {getStatusBadge(refund.new_value?.refund_id)}
                                </div>
                              </div>
                              {expandedEntry === refund.id ? (
                                <ChevronUp className="h-4 w-4 shrink-0 ml-2" />
                              ) : (
                                <ChevronDown className="h-4 w-4 shrink-0 ml-2" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="mt-4 pt-4 border-t space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">{rh.processedBy || 'Processed by'}:</span>
                                <span>{refund.user_email || (rh.system || 'System')}</span>
                              </div>
                              <div className="flex items-start gap-2 text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-muted-foreground">{rh.refundId || 'Refund ID'}:</span>
                                  <code className="ml-2 text-xs break-all">
                                    {refund.new_value?.refund_id || 'N/A'}
                                  </code>
                                </div>
                              </div>
                              {refund.new_value?.reason && (
                                <div className="flex items-start gap-2 text-sm">
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                  <div>
                                    <span className="text-muted-foreground">{rh.reason || 'Reason'}:</span>
                                    <p className="mt-1">{refund.new_value.reason}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
