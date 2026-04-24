import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, User, Settings, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  setting_key: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  action: string;
  created_at: string;
}

export function SettingsAuditLog() {
  const { t } = useLanguage();
  const al = (t as any).auditLog || {};
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const SETTING_LABELS: Record<string, string> = {
    business_info: al.businessInfo || 'Business Information',
    social_links: al.socialLinks || 'Social Media Links',
    business_hours: al.businessHours || 'Business Hours',
    booking_policies: al.bookingPolicies || 'Booking Policies',
    currency: al.currencySettings || 'Currency Settings',
    tax_settings: al.taxSettings || 'Tax Settings',
    email_settings: al.emailSettings || 'Email Settings',
    sms_settings: al.smsSettings || 'SMS Settings',
    security_settings: al.securitySettings || 'Security Settings',
    appearance_settings: al.appearanceSettings || 'Appearance Settings',
    stripe_settings: al.stripeConfig || 'Stripe Configuration',
    paypal_settings: al.paypalConfig || 'PayPal Configuration',
  };

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['settings-audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const getSettingLabel = (key: string) => {
    return SETTING_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatChanges = (oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) => {
    if (!oldValue || !newValue) return null;
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    const allKeys = new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})]);
    allKeys.forEach((key) => {
      const oldVal = oldValue?.[key];
      const newVal = newValue?.[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ field: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), from: oldVal, to: newVal });
      }
    });
    return changes;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'boolean') return value ? (t.common.yes || 'Yes') : (t.common.no || 'No');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {al.title || 'Settings Audit Log'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          {al.title || 'Settings Audit Log'}
        </CardTitle>
        <CardDescription>
          {al.description || 'Track all changes made to admin settings'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{al.noChanges || 'No changes recorded yet'}</p>
            <p className="text-sm">{al.changesWillAppear || 'Changes will appear here when settings are modified'}</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {auditLogs.map((entry) => {
                const changes = formatChanges(entry.old_value, entry.new_value);
                const isExpanded = expandedEntry === entry.id;

                return (
                  <Collapsible key={entry.id} open={isExpanded} onOpenChange={(open) => setExpandedEntry(open ? entry.id : null)}>
                    <div className="rounded-lg border bg-card p-3">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                          <div className="flex items-start gap-3 text-left">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <Settings className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{getSettingLabel(entry.setting_key)}</span>
                                <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span>{entry.user_email || (al.unknownUser || 'Unknown user')}</span>
                                <span>•</span>
                                <span>{format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}</span>
                              </div>
                            </div>
                          </div>
                          {changes && changes.length > 0 && (
                            isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      {changes && changes.length > 0 && (
                        <CollapsibleContent>
                          <div className="mt-3 pt-3 border-t space-y-2">
                            {changes.map((change, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium">{change.field}:</span>
                                <div className="flex items-center gap-2 mt-0.5 pl-2">
                                  <span className="text-red-500 line-through truncate max-w-[150px]">{formatValue(change.from)}</span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="text-green-500 truncate max-w-[150px]">{formatValue(change.to)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}