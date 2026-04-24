import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BillingDetails } from '@/types/booking';
import { Building2, MapPin, AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface BillingDetailsFormProps {
  billingDetails: BillingDetails;
  onChange: (details: BillingDetails) => void;
  showValidation?: boolean;
  pickupLocation?: string;
}

interface FieldTouched {
  fullName: boolean;
  address: boolean;
  city: boolean;
  postalCode: boolean;
  country: boolean;
}

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
];

export function BillingDetailsForm({ billingDetails, onChange, showValidation = false, pickupLocation }: BillingDetailsFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const b = (t as any).billing || {};
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [hasSavedBilling, setHasSavedBilling] = useState(false);
  const [usePickupAsAddress, setUsePickupAsAddress] = useState(false);
  const [touched, setTouched] = useState<FieldTouched>({
    fullName: false,
    address: false,
    city: false,
    postalCode: false,
    country: false,
  });

  // Validation rules
  const validateField = (field: keyof BillingDetails, value: string): string | null => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) return b.fullNameRequired || 'Full name is required for invoicing';
        if (value.trim().length < 2) return b.nameMinLength || 'Name must be at least 2 characters';
        if (value.trim().length > 100) return b.nameMaxLength || 'Name must be less than 100 characters';
        return null;
      case 'address':
        if (!value.trim()) return b.addressRequired || 'Street address is required';
        if (value.trim().length < 5) return b.addressInvalid || 'Please enter a valid address';
        if (value.trim().length > 200) return b.addressMaxLength || 'Address must be less than 200 characters';
        return null;
      case 'city':
        if (!value.trim()) return b.cityRequired || 'City is required';
        if (value.trim().length < 2) return b.cityInvalid || 'Please enter a valid city name';
        return null;
      case 'postalCode':
        if (!value.trim()) return b.postalCodeRequired || 'Postal/ZIP code is required';
        if (value.trim().length < 3) return b.postalCodeInvalid || 'Please enter a valid postal code';
        return null;
      case 'country':
        if (!value) return b.countryRequired || 'Please select a country';
        return null;
      default:
        return null;
    }
  };

  // Load saved billing details from profile on mount
  useEffect(() => {
    const loadSavedBilling = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('billing_full_name, billing_company_name, billing_address, billing_city, billing_state, billing_postal_code, billing_country, billing_vat_number')
          .eq('id', user.id)
          .single();

        if (profile && profile.billing_full_name) {
          setHasSavedBilling(true);
          if (!billingDetails.fullName && !billingDetails.address) {
            onChange({
              fullName: profile.billing_full_name || '',
              companyName: profile.billing_company_name || '',
              address: profile.billing_address || '',
              city: profile.billing_city || '',
              state: profile.billing_state || '',
              postalCode: profile.billing_postal_code || '',
              country: profile.billing_country || '',
              vatNumber: profile.billing_vat_number || '',
            });
          }
        }
      } catch (error) {
        console.error('Error loading saved billing:', error);
      }
    };

    loadSavedBilling();
  }, [user]);

  // Save billing details when checkbox is checked and details change
  useEffect(() => {
    const saveBillingToProfile = async () => {
      if (!user || !saveToProfile) return;
      if (!billingDetails.fullName || !billingDetails.address) return;

      try {
        await supabase
          .from('profiles')
          .update({
            billing_full_name: billingDetails.fullName,
            billing_company_name: billingDetails.companyName,
            billing_address: billingDetails.address,
            billing_city: billingDetails.city,
            billing_state: billingDetails.state,
            billing_postal_code: billingDetails.postalCode,
            billing_country: billingDetails.country,
            billing_vat_number: billingDetails.vatNumber,
          })
          .eq('id', user.id);

        setHasSavedBilling(true);
      } catch (error) {
        console.error('Error saving billing:', error);
      }
    };

    const timer = setTimeout(saveBillingToProfile, 1000);
    return () => clearTimeout(timer);
  }, [user, saveToProfile, billingDetails]);

  const handleChange = (field: keyof BillingDetails, value: string) => {
    onChange({ ...billingDetails, [field]: value });
  };

  const handleBlur = (field: keyof FieldTouched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const getError = (field: keyof BillingDetails): string | null => {
    const isTouched = field in touched ? touched[field as keyof FieldTouched] : false;
    if (!isTouched && !showValidation) return null;
    return validateField(field, billingDetails[field] || '');
  };

  const isFieldValid = (field: keyof BillingDetails): boolean => {
    const isTouched = field in touched ? touched[field as keyof FieldTouched] : false;
    if (!isTouched) return false;
    return validateField(field, billingDetails[field] || '') === null && (billingDetails[field] || '').trim().length > 0;
  };

  const requiredFields: (keyof BillingDetails)[] = ['fullName', 'address', 'city', 'postalCode', 'country'];
  const filledRequiredCount = requiredFields.filter(f => (billingDetails[f] || '').trim().length > 0).length;
  const allRequiredFilled = filledRequiredCount === requiredFields.length;

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      {showValidation && (
        <div className={cn(
          "flex items-center gap-2 text-sm rounded-lg p-3 border",
          allRequiredFilled 
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
            : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
        )}>
          {allRequiredFilled ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>{b.allFieldsCompleted || 'All required billing fields completed'}</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>{(b.fieldsCompleted || '{filled} of {total} required fields completed').replace('{filled}', String(filledRequiredCount)).replace('{total}', String(requiredFields.length))}</span>
            </>
          )}
        </div>
      )}

      {/* Personal / Company Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Building2 className="h-4 w-4 text-primary" />
          <span>{b.personalCompanyInfo || 'Personal / Company Information'}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-1">
              {b.fullName || 'Full Name'} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              placeholder={(t as any).placeholders?.fullName || "John Doe"}
              value={billingDetails.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              onBlur={() => handleBlur('fullName')}
              className={cn(
                getError('fullName') && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {getError('fullName') ? (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {getError('fullName')}
              </p>
            ) : isFieldValid('fullName') && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {b.looksGood || 'Looks good'}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">{b.companyName || 'Company Name'}</Label>
            <Input
              id="companyName"
              placeholder={b.companyNameOptional || 'Acme Inc. (optional)'}
              value={billingDetails.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{b.optional || 'Optional'}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatNumber">{b.vatNumber || 'VAT / Tax ID'}</Label>
          <Input
            id="vatNumber"
            placeholder={b.vatPlaceholder || 'VAT123456789 (optional)'}
            value={billingDetails.vatNumber}
            onChange={(e) => handleChange('vatNumber', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{b.vatHint || 'Optional - for business invoices'}</p>
        </div>
      </div>

      {/* Address Info */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{b.billingAddress || 'Billing Address'}</span>
          </div>
        </div>

        {/* Use Pickup Location Checkbox */}
        {pickupLocation && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox
              id="usePickupAddress"
              checked={usePickupAsAddress}
              onCheckedChange={(checked) => {
                const isChecked = checked === true;
                setUsePickupAsAddress(isChecked);
                if (isChecked && pickupLocation) {
                  onChange({
                    ...billingDetails,
                    address: pickupLocation,
                  });
                }
              }}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="usePickupAddress" className="cursor-pointer text-sm font-medium">
                {b.usePickupAsBilling || 'Use pickup location as billing address'}
              </Label>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {pickupLocation}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-1">
            {b.streetAddress || 'Street Address'} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="address"
            placeholder={(t as any).placeholders?.streetAddress || "123 Main Street, Apt 4B"}
            value={billingDetails.address}
            onChange={(e) => {
              handleChange('address', e.target.value);
              if (usePickupAsAddress) {
                setUsePickupAsAddress(false);
              }
            }}
            onBlur={() => handleBlur('address')}
            className={cn(
              getError('address') && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {getError('address') && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {getError('address')}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city" className="flex items-center gap-1">
              {b.city || 'City'} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="city"
              placeholder={(t as any).placeholders?.city || "New York"}
              value={billingDetails.city}
              onChange={(e) => handleChange('city', e.target.value)}
              onBlur={() => handleBlur('city')}
              className={cn(
                getError('city') && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {getError('city') && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {getError('city')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">{b.stateProvince || 'State / Province'}</Label>
            <Input
              id="state"
              placeholder={(t as any).placeholders?.state || "NY"}
              value={billingDetails.state}
              onChange={(e) => handleChange('state', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{b.optional || 'Optional'}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="postalCode" className="flex items-center gap-1">
              {b.postalCode || 'Postal / ZIP Code'} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="postalCode"
              placeholder={(t as any).placeholders?.postalCode || "10001"}
              value={billingDetails.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
              onBlur={() => handleBlur('postalCode')}
              className={cn(
                getError('postalCode') && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {getError('postalCode') && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {getError('postalCode')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="country" className="flex items-center gap-1">
              {b.country || 'Country'} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={billingDetails.country}
              onValueChange={(value) => {
                handleChange('country', value);
                handleBlur('country');
              }}
            >
              <SelectTrigger 
                id="country"
                className={cn(
                  getError('country') && "border-destructive focus-visible:ring-destructive"
                )}
              >
                <SelectValue placeholder={b.selectCountry || 'Select country'} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getError('country') && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {getError('country')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Save to Profile Option - only for logged in users */}
      {user && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Checkbox
            id="saveToProfile"
            checked={saveToProfile}
            onCheckedChange={(checked) => setSaveToProfile(checked === true)}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <Label htmlFor="saveToProfile" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <Save className="h-4 w-4 text-primary" />
              {b.saveBillingDetails || 'Save billing details for future bookings'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {hasSavedBilling 
                ? (b.billingDetailsSaved || 'Your billing details are saved. Toggle on to update them with changes.')
                : (b.billingDetailsRemember || "We'll remember these details so you don't have to enter them again.")}
            </p>
            {saveToProfile && billingDetails.fullName && billingDetails.address && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {b.billingAutoSave || 'Billing details will be saved automatically'}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {b.requiredFieldsNote || "Fields marked with * are required if you need an invoice. Leave all fields empty if you don't require billing documentation."}
      </p>
    </div>
  );
}
