import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Building2, CalendarIcon, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface CompanyBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  iban: string;
  swiftCode: string;
  instructions: string;
}

export interface BankTransferDetails {
  senderName: string;
  bankName: string;
  transferReference: string;
  transferDate: string;
  amountTransferred: string;
  notes: string;
}

export const initialBankTransferDetails: BankTransferDetails = {
  senderName: '',
  bankName: '',
  transferReference: '',
  transferDate: '',
  amountTransferred: '',
  notes: '',
};

interface BankTransferFormProps {
  details: BankTransferDetails;
  onChange: (details: BankTransferDetails) => void;
}

export function BankTransferForm({ details, onChange }: BankTransferFormProps) {
  const [companyBank, setCompanyBank] = useState<CompanyBankDetails | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { t } = useLanguage();
  const bt = t.bankTransfer;

  useEffect(() => {
    const fetchBankSettings = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'bank_settings')
        .single();
      if (data?.value) {
        const v = data.value as Record<string, unknown>;
        setCompanyBank({
          bankName: (v.bankName as string) || '',
          accountName: (v.accountName as string) || '',
          accountNumber: (v.accountNumber as string) || '',
          routingNumber: (v.routingNumber as string) || '',
          iban: (v.iban as string) || '',
          swiftCode: (v.swiftCode as string) || '',
          instructions: (v.instructions as string) || '',
        });
      }
    };
    fetchBankSettings();
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const update = (field: keyof BankTransferDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  const CopyButton = ({ value, field }: { value: string; field: string }) => (
    <button
      type="button"
      onClick={() => copyToClipboard(value, field)}
      className="ml-1 inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
      title={bt.copy || 'Copy'}
    >
      {copiedField === field ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      {companyBank && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Building2 className="h-4 w-4" />
            {bt.transferToAccount}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {companyBank.bankName && (
              <div>
                <span className="text-muted-foreground">{bt.bank}</span>{' '}
                <span className="font-medium text-foreground">{companyBank.bankName}</span>
                <CopyButton value={companyBank.bankName} field="cb" />
              </div>
            )}
            {companyBank.accountName && (
              <div>
                <span className="text-muted-foreground">{bt.accountName}</span>{' '}
                <span className="font-medium text-foreground">{companyBank.accountName}</span>
                <CopyButton value={companyBank.accountName} field="ca" />
              </div>
            )}
            {companyBank.accountNumber && (
              <div>
                <span className="text-muted-foreground">{bt.accountHash}</span>{' '}
                <span className="font-medium text-foreground">{companyBank.accountNumber}</span>
                <CopyButton value={companyBank.accountNumber} field="cn" />
              </div>
            )}
            {companyBank.routingNumber && (
              <div>
                <span className="text-muted-foreground">{bt.routingHash}</span>{' '}
                <span className="font-medium text-foreground">{companyBank.routingNumber}</span>
                <CopyButton value={companyBank.routingNumber} field="cr" />
              </div>
            )}
            {companyBank.iban && (
              <div>
                <span className="text-muted-foreground">{bt.iban}</span>{' '}
                <span className="font-medium text-foreground">{companyBank.iban}</span>
                <CopyButton value={companyBank.iban} field="ci" />
              </div>
            )}
            {companyBank.swiftCode && (
              <div>
                <span className="text-muted-foreground">{bt.swift}</span>{' '}
                <span className="font-medium text-foreground">{companyBank.swiftCode}</span>
                <CopyButton value={companyBank.swiftCode} field="cs" />
              </div>
            )}
          </div>
          {companyBank.instructions && (
            <p className="text-xs text-muted-foreground italic border-t border-primary/20 pt-2">
              {companyBank.instructions}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Building2 className="h-4 w-4 text-primary" />
        {bt.yourTransferDetails}
      </div>
      <p className="text-xs text-muted-foreground">
        {bt.provideDetails}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="senderName">{bt.senderName}</Label>
          <Input
            id="senderName"
            placeholder={bt.senderNamePlaceholder}
            value={details.senderName}
            onChange={(e) => update('senderName', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bankName">{bt.bankName}</Label>
          <Input
            id="bankName"
            placeholder={bt.bankNamePlaceholder}
            value={details.bankName}
            onChange={(e) => update('bankName', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="transferReference">{bt.transferReference}</Label>
          <Input
            id="transferReference"
            placeholder={bt.transferReferencePlaceholder}
            value={details.transferReference}
            onChange={(e) => update('transferReference', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{bt.transferDate}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !details.transferDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {details.transferDate
                  ? format(new Date(details.transferDate), 'PPP')
                  : bt.pickADate}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={details.transferDate ? new Date(details.transferDate) : undefined}
                onSelect={(date) =>
                  update('transferDate', date ? format(date, 'yyyy-MM-dd') : '')
                }
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amountTransferred">{bt.amountTransferred}</Label>
          <Input
            id="amountTransferred"
            placeholder={bt.amountPlaceholder}
            value={details.amountTransferred}
            onChange={(e) => update('amountTransferred', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bankNotes">{bt.additionalNotes}</Label>
        <Textarea
          id="bankNotes"
          placeholder={bt.notesPlaceholder}
          value={details.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}
