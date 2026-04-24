import { useState } from 'react';
import { Building2, Clock, DollarSign, Percent, Facebook, Twitter, Instagram, Linkedin, Link as LinkIcon, Check, ChevronsUpDown, Ruler, MapPin, Youtube, Music2, Languages, Plus, X, Search, Globe } from 'lucide-react';
import { BulkTranslationManager } from './BulkTranslationManager';
import { Language, ALL_LANGUAGES, TRANSLATED_LANGUAGES } from '@/i18n/translations';
import { useLanguagesFromDB, type DBLanguage } from '@/hooks/useLanguagesFromDB';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { FieldError } from './FieldError';
import { TIMEZONES, CURRENCIES, DAYS_OF_WEEK } from './constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import type { BusinessInfo, SocialLinks, BusinessHours, CurrencySettings, TaxSettings, DistanceUnitSettings, MapLocationSettings, FieldErrors } from './types';

const LANGUAGES = ALL_LANGUAGES;
const AVAILABLE_LANGUAGE_CODES = ALL_LANGUAGES.map(l => l.code);

interface GeneralSettingsTabProps {
  businessInfo: BusinessInfo;
  setBusinessInfo: React.Dispatch<React.SetStateAction<BusinessInfo>>;
  socialLinks: SocialLinks;
  setSocialLinks: React.Dispatch<React.SetStateAction<SocialLinks>>;
  businessHours: BusinessHours;
  setBusinessHours: React.Dispatch<React.SetStateAction<BusinessHours>>;
  currency: CurrencySettings;
  setCurrency: React.Dispatch<React.SetStateAction<CurrencySettings>>;
  taxSettings: TaxSettings;
  setTaxSettings: React.Dispatch<React.SetStateAction<TaxSettings>>;
  distanceUnit: DistanceUnitSettings;
  setDistanceUnit: React.Dispatch<React.SetStateAction<DistanceUnitSettings>>;
  mapLocation: MapLocationSettings;
  setMapLocation: React.Dispatch<React.SetStateAction<MapLocationSettings>>;
  defaultLanguage: Language;
  setDefaultLanguage: React.Dispatch<React.SetStateAction<Language>>;
  enabledLanguages: Language[];
  setEnabledLanguages: React.Dispatch<React.SetStateAction<Language[]>>;
  errors: FieldErrors;
}

export function GeneralSettingsTab({
  businessInfo,
  setBusinessInfo,
  socialLinks,
  setSocialLinks,
  businessHours,
  setBusinessHours,
  currency,
  setCurrency,
  taxSettings,
  setTaxSettings,
  distanceUnit,
  setDistanceUnit,
  mapLocation,
  setMapLocation,
  defaultLanguage,
  setDefaultLanguage,
  enabledLanguages,
  setEnabledLanguages,
  errors,
}: GeneralSettingsTabProps) {
  const [tzOpen, setTzOpen] = useState(false);
  const [currOpen, setCurrOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const { t } = useLanguage();
  const { languages: dbLanguages, activeLanguages: dbActive, inactiveLanguages: dbInactive, toggleLanguage: dbToggle, isLoading: dbLangLoading } = useLanguagesFromDB();

  const toggleDay = (day: string) => {
    setBusinessHours(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleCurrencyChange = (code: string) => {
    const selected = CURRENCIES.find(c => c.code === code);
    if (selected) {
      setCurrency(prev => ({
        ...prev,
        code: selected.code,
        symbol: selected.symbol,
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Business Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t.adminSettings.businessInformation}
          </CardTitle>
          <CardDescription>
            {t.adminSettings.companyDetailsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">{t.adminSettings.companyName} *</Label>
            <Input
              id="companyName"
              value={businessInfo.companyName}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder={(t as any).placeholders?.companyName || "Your company name"}
              className={errors['businessInfo.companyName'] ? 'border-destructive' : ''}
            />
            <FieldError field="businessInfo.companyName" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.adminSettings.supportEmail} *</Label>
            <Input
              id="email"
              type="email"
              value={businessInfo.email}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, email: e.target.value }))}
              placeholder={(t as any).placeholders?.adminEmail || "support@example.com"}
              className={errors['businessInfo.email'] ? 'border-destructive' : ''}
            />
            <FieldError field="businessInfo.email" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t.adminSettings.phoneNumber} *</Label>
            <Input
              id="phone"
              value={businessInfo.phone}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, phone: e.target.value }))}
              placeholder={(t as any).placeholders?.phone || "+1 (555) 000-0000"}
              className={errors['businessInfo.phone'] ? 'border-destructive' : ''}
            />
            <FieldError field="businessInfo.phone" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">{t.adminSettings.timezone} *</Label>
            <Popover open={tzOpen} onOpenChange={setTzOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={tzOpen}
                  className="w-full justify-between font-normal"
                >
                  {businessInfo.timezone || t.adminSettings.selectTimezone}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 bg-popover z-50" align="start">
                <Command>
                  <CommandInput placeholder={t.adminSettings.searchTimezone} />
                  <CommandList>
                    <CommandEmpty>{t.adminSettings.noTimezoneFound}</CommandEmpty>
                    <CommandGroup>
                      {TIMEZONES.map((tz) => (
                        <CommandItem
                          key={tz}
                          value={tz}
                          onSelect={() => {
                            setBusinessInfo(prev => ({ ...prev, timezone: tz }));
                            setTzOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", businessInfo.timezone === tz ? "opacity-100" : "opacity-0")} />
                          {tz}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">{t.adminSettings.website}</Label>
            <Input
              id="website"
              type="url"
              value={businessInfo.website}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://www.example.com"
              className={errors['businessInfo.website'] ? 'border-destructive' : ''}
            />
            <FieldError field="businessInfo.website" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">{t.adminSettings.taxIdVat}</Label>
            <Input
              id="taxId"
              value={businessInfo.taxId}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, taxId: e.target.value }))}
              placeholder="XX-XXXXXXX"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrationNumber">{(t.adminSettings as any).registrationNumber || 'Registration Number'}</Label>
            <Input
              id="registrationNumber"
              value={businessInfo.registrationNumber || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, registrationNumber: e.target.value }))}
              placeholder="REG-XXXXXXX"
            />
            <p className="text-xs text-muted-foreground">{(t.adminSettings as any).registrationNumberHint || 'Business registration or license number shown on invoices'}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tagline">{(t.adminSettings as any).tagline || 'Business Tagline'}</Label>
            <Input
              id="tagline"
              value={businessInfo.tagline || ''}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, tagline: e.target.value }))}
              placeholder={(t.adminSettings as any).taglinePlaceholder || 'Premium Transportation Services'}
            />
            <p className="text-xs text-muted-foreground">{(t.adminSettings as any).taglineHint || 'Short description shown on invoices and receipts'}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">{t.adminSettings.businessAddress}</Label>
            <Input
              id="address"
              value={businessInfo.address}
              onChange={(e) => setBusinessInfo(prev => ({ ...prev, address: e.target.value }))}
              placeholder="123 Main St, City, Country"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            {t.adminSettings.socialMediaLinks}
          </CardTitle>
          <CardDescription>
            {t.adminSettings.connectSocialProfiles}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="facebook" className="flex items-center gap-2">
              <Facebook className="h-4 w-4 text-[#1877F2]" />
              Facebook
            </Label>
            <Input id="facebook" type="url" value={socialLinks.facebook} onChange={(e) => setSocialLinks(prev => ({ ...prev, facebook: e.target.value }))} placeholder="https://facebook.com/yourpage" className={errors['socialLinks.facebook'] ? 'border-destructive' : ''} />
            <FieldError field="socialLinks.facebook" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitter" className="flex items-center gap-2">
              <Twitter className="h-4 w-4 text-[#1DA1F2]" />
              Twitter / X
            </Label>
            <Input id="twitter" type="url" value={socialLinks.twitter} onChange={(e) => setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))} placeholder="https://twitter.com/yourhandle" className={errors['socialLinks.twitter'] ? 'border-destructive' : ''} />
            <FieldError field="socialLinks.twitter" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-[#E4405F]" />
              Instagram
            </Label>
            <Input id="instagram" type="url" value={socialLinks.instagram} onChange={(e) => setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))} placeholder="https://instagram.com/yourprofile" className={errors['socialLinks.instagram'] ? 'border-destructive' : ''} />
            <FieldError field="socialLinks.instagram" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin" className="flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              LinkedIn
            </Label>
            <Input id="linkedin" type="url" value={socialLinks.linkedin} onChange={(e) => setSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))} placeholder="https://linkedin.com/company/yourcompany" className={errors['socialLinks.linkedin'] ? 'border-destructive' : ''} />
            <FieldError field="socialLinks.linkedin" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tiktok" className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-[#000000] dark:text-[#ffffff]" />
              TikTok
            </Label>
            <Input id="tiktok" type="url" value={socialLinks.tiktok} onChange={(e) => setSocialLinks(prev => ({ ...prev, tiktok: e.target.value }))} placeholder="https://tiktok.com/@yourhandle" className={errors['socialLinks.tiktok'] ? 'border-destructive' : ''} />
            <FieldError field="socialLinks.tiktok" errors={errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube" className="flex items-center gap-2">
              <Youtube className="h-4 w-4 text-[#FF0000]" />
              YouTube
            </Label>
            <Input id="youtube" type="url" value={socialLinks.youtube} onChange={(e) => setSocialLinks(prev => ({ ...prev, youtube: e.target.value }))} placeholder="https://youtube.com/@yourchannel" className={errors['socialLinks.youtube'] ? 'border-destructive' : ''} />
            <FieldError field="socialLinks.youtube" errors={errors} />
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t.adminSettings.businessHours}
          </CardTitle>
          <CardDescription>
            {t.adminSettings.setOperatingHours}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">{t.adminSettings.openingTime}</Label>
              <Input id="startTime" type="time" value={businessHours.start} onChange={(e) => setBusinessHours(prev => ({ ...prev, start: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">{t.adminSettings.closingTime}</Label>
              <Input id="endTime" type="time" value={businessHours.end} onChange={(e) => setBusinessHours(prev => ({ ...prev, end: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.adminSettings.operatingDays}</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={businessHours.daysOfWeek.includes(day.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleDay(day.value)}
                  className="min-w-[3rem]"
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency & Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {t.adminSettings.currencyTaxSettings}
          </CardTitle>
          <CardDescription>
            {t.adminSettings.configureCurrencyTax}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.adminSettings.currency}</Label>
              <Popover open={currOpen} onOpenChange={setCurrOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={currOpen} className="w-full justify-between font-normal">
                    {currency.code ? `${currency.symbol} - ${CURRENCIES.find(c => c.code === currency.code)?.name || currency.code} (${currency.code})` : t.adminSettings.selectCurrency}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 bg-popover z-50" align="start">
                  <Command>
                    <CommandInput placeholder={t.adminSettings.searchCurrency} />
                    <CommandList>
                      <CommandEmpty>{t.adminSettings.noCurrencyFound}</CommandEmpty>
                      <CommandGroup>
                        {CURRENCIES.map((c) => (
                          <CommandItem key={c.code} value={`${c.code} ${c.name} ${c.symbol}`} onSelect={() => { handleCurrencyChange(c.code); setCurrOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", currency.code === c.code ? "opacity-100" : "opacity-0")} />
                            {c.symbol} - {c.name} ({c.code})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{t.adminSettings.symbolPosition}</Label>
              <Select value={currency.position} onValueChange={(v: 'before' | 'after') => setCurrency(prev => ({ ...prev, position: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">{t.adminSettings.beforeAmount} ({currency.symbol}100)</SelectItem>
                  <SelectItem value="after">{t.adminSettings.afterAmount} (100{currency.symbol})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Distance Unit */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              {t.adminSettings.distanceUnits}
            </Label>
            <p className="text-xs text-muted-foreground">{t.adminSettings.distanceUnitsDesc}</p>
            <Select value={distanceUnit.unit} onValueChange={(v: 'km' | 'miles') => setDistanceUnit({ unit: v })}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="km">{t.adminSettings.kilometers} (km)</SelectItem>
                <SelectItem value="miles">{t.adminSettings.miles} (mi)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Enabled Languages */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t.adminSettings.enabledLanguages || 'Enabled Languages'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t.adminSettings.enabledLanguagesDesc || 'Select which languages are available to users. English is always enabled.'}
            </p>

            {/* Currently enabled languages with completeness */}
            {dbActive.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{(t.adminSettings.activeLanguagesCount || 'Active ({count})').replace('{count}', String(dbActive.length))}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dbActive.map((lang) => {
                    const isEnglish = lang.code === 'en';
                    return (
                      <div
                        key={lang.code}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 group"
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{lang.native_name}</span>
                            <span className="text-xs text-muted-foreground">({lang.name})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={lang.translation_completeness} className="h-1.5 flex-1" />
                            <span className={`text-[10px] font-medium shrink-0 ${
                              lang.translation_completeness >= 80 ? 'text-green-600 dark:text-green-400' :
                              lang.translation_completeness >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-muted-foreground'
                            }`}>
                              {lang.translation_completeness}%
                            </span>
                          </div>
                        </div>
                        {!isEnglish && (
                          <button
                            type="button"
                            onClick={() => {
                              dbToggle(lang.code, false);
                              const updated = enabledLanguages.filter(l => l !== lang.code);
                              setEnabledLanguages(updated);
                              if (defaultLanguage === lang.code) setDefaultLanguage('en');
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add languages - searchable list */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder={t.adminSettings.searchLanguagesPlaceholder || 'Search languages...'}
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {langSearch && (
                  <button onClick={() => setLangSearch('')} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="max-h-[280px] overflow-y-auto p-1">
                {(() => {
                  const filtered = dbInactive.filter(lang =>
                    lang.name.toLowerCase().includes(langSearch.toLowerCase()) ||
                    lang.native_name.toLowerCase().includes(langSearch.toLowerCase()) ||
                    lang.code.toLowerCase().includes(langSearch.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {langSearch
                          ? (t.adminSettings.noLanguagesFound || 'No languages found')
                          : (t.adminSettings.allLanguagesEnabled || 'All languages enabled')}
                      </p>
                    );
                  }
                  return filtered.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        dbToggle(lang.code, true);
                        setEnabledLanguages([...enabledLanguages, lang.code as Language]);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-accent/50 transition-colors text-left group"
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span className="flex-1 min-w-0">
                        <span className="font-medium">{lang.native_name}</span>
                        <span className="text-muted-foreground ml-1.5">({lang.name})</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-medium ${
                          lang.translation_completeness >= 80 ? 'text-green-600 dark:text-green-400' :
                          lang.translation_completeness >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-muted-foreground'
                        }`}>
                          {lang.translation_completeness}%
                        </span>
                        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>

          <Separator />

          {/* Default Language */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              {t.adminSettings.defaultLanguage}
            </Label>
            <p className="text-xs text-muted-foreground">{t.adminSettings.defaultLanguageDesc}</p>
            <Select value={defaultLanguage} onValueChange={(v) => setDefaultLanguage(v as Language)}>
              <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {dbActive.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.flag} {lang.native_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Bulk Translation */}
          <BulkTranslationManager />

          <Separator />

          {/* Default Map Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t.adminSettings.defaultMapLocation}
            </Label>
            <p className="text-xs text-muted-foreground">{t.adminSettings.defaultMapLocationDesc}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultLat">{t.adminSettings.latitude}</Label>
                <Input id="defaultLat" type="number" step="0.0001" value={mapLocation.defaultLat} onChange={(e) => setMapLocation(prev => ({ ...prev, defaultLat: parseFloat(e.target.value) || 0 }))} placeholder="46.6863" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultLng">{t.adminSettings.longitude}</Label>
                <Input id="defaultLng" type="number" step="0.0001" value={mapLocation.defaultLng} onChange={(e) => setMapLocation(prev => ({ ...prev, defaultLng: parseFloat(e.target.value) || 0 }))} placeholder="7.8632" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Tax Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t.adminSettings.taxEnabled}</Label>
                <p className="text-xs text-muted-foreground">{t.adminSettings.enableTaxCalc}</p>
              </div>
              <Switch checked={taxSettings.enabled} onCheckedChange={(checked) => setTaxSettings(prev => ({ ...prev, enabled: checked }))} />
            </div>

            {taxSettings.enabled && (
              <div className="grid gap-4 sm:grid-cols-3 ml-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">{t.adminSettings.taxRate}</Label>
                  <Input id="taxRate" type="number" min={0} max={100} step={0.1} value={taxSettings.rate} onChange={(e) => setTaxSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))} className={errors['taxSettings.rate'] ? 'border-destructive' : ''} />
                  <FieldError field="taxSettings.rate" errors={errors} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxLabel">{t.adminSettings.taxLabel}</Label>
                  <Input id="taxLabel" value={taxSettings.label} onChange={(e) => setTaxSettings(prev => ({ ...prev, label: e.target.value }))} placeholder="VAT" />
                  <p className="text-xs text-muted-foreground">{t.adminSettings.taxLabelHint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={taxSettings.includeInPrice} onCheckedChange={(checked) => setTaxSettings(prev => ({ ...prev, includeInPrice: checked }))} />
                  <div>
                    <Label>{t.adminSettings.taxIncluded}</Label>
                    <p className="text-xs text-muted-foreground">{t.adminSettings.taxIncludedHint}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}