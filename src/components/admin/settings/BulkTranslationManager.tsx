import { useState, useEffect } from 'react';
import { Languages, Loader2, CheckCircle2, AlertCircle, Sparkles, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { translations, ALL_LANGUAGES } from '@/i18n/translations';
import { en } from '@/i18n/translations/en';
import { useLanguage } from '@/contexts/LanguageContext';

function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], fullKey));
    } else if (typeof obj[key] === 'string') {
      result[fullKey] = obj[key];
    }
  }
  return result;
}

const allEnglishKeys = flattenObject(en);
const canonicalEnglishKeySet = new Set(Object.keys(allEnglishKeys));

function getMissingKeys(langCode: string): { key: string; englishValue: string }[] {
  const langTranslations = (translations as Record<string, any>)[langCode];
  if (!langTranslations) {
    return Object.entries(allEnglishKeys).map(([key, val]) => ({ key, englishValue: val }));
  }
  const flatLang = flattenObject(langTranslations);
  const missing: { key: string; englishValue: string }[] = [];
  for (const [key, englishVal] of Object.entries(allEnglishKeys)) {
    const langVal = flatLang[key];
    if (!langVal || langVal === englishVal) {
      missing.push({ key, englishValue: englishVal });
    }
  }
  return missing;
}

interface LanguageStatus {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  totalKeys: number;
  missingKeys: number;
  completeness: number;
  selected: boolean;
}

async function fetchOverrideKeyStatsForLanguage(
  langCode: string,
  validKeySet: Set<string>
): Promise<{ validKeys: Set<string>; staleCount: number }> {
  const validKeys = new Set<string>();
  let staleCount = 0;
  const PAGE_SIZE = 1000;
  let lastKey: string | null = null;

  while (true) {
    let query = supabase
      .from('translation_overrides')
      .select('translation_key')
      .eq('language_code', langCode)
      .order('translation_key', { ascending: true })
      .limit(PAGE_SIZE);

    if (lastKey) {
      query = query.gt('translation_key', lastKey);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Failed to load overrides for ${langCode}:`, error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      if (validKeySet.has(row.translation_key)) validKeys.add(row.translation_key);
      else staleCount += 1;
    }

    lastKey = data[data.length - 1].translation_key;
    if (data.length < PAGE_SIZE) break;
  }

  return { validKeys, staleCount };
}

export function BulkTranslationManager() {
  const { t } = useLanguage();
  const bt = (t as any).bulkTranslation || {};
  const [languages, setLanguages] = useState<LanguageStatus[]>([]);
  const [translating, setTranslating] = useState(false);
  const [currentLang, setCurrentLang] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ lang: string; translated: number; total: number }[]>([]);

  const totalKeys = Object.keys(allEnglishKeys).length;

  useEffect(() => {
    loadLanguageStatuses();
  }, []);

  async function loadLanguageStatuses() {
    const { data: dbLangs } = await supabase
      .from('languages')
      .select('code, is_active')
      .eq('is_active', true);

    const enabledCodes = new Set(dbLangs?.map(l => l.code) || []);
    const enabledNonEnglish = ALL_LANGUAGES
      .filter(l => l.code !== 'en' && enabledCodes.has(l.code));

    const overrideEntries = await Promise.all(
      enabledNonEnglish.map(async (lang) => {
        const stats = await fetchOverrideKeyStatsForLanguage(lang.code, canonicalEnglishKeySet);
        return [lang.code, stats] as const;
      })
    );

    const overrideStats = Object.fromEntries(overrideEntries) as Record<string, { validKeys: Set<string>; staleCount: number }>;

    const statuses: LanguageStatus[] = enabledNonEnglish
      .map(l => {
        const missing = getMissingKeys(l.code);
        const validOverrideCount = overrideStats[l.code]?.validKeys.size || 0;
        const effectiveMissing = Math.max(0, missing.length - validOverrideCount);
        const completeness = Math.round(((totalKeys - effectiveMissing) / totalKeys) * 100);
        return { ...l, totalKeys, missingKeys: effectiveMissing, completeness, selected: effectiveMissing > 0 };
      })
      .sort((a, b) => a.completeness - b.completeness);

    setLanguages(statuses);

    // Sync completeness back to languages table so other UI components show correct %
    for (const s of statuses) {
      await supabase
        .from('languages')
        .update({ translation_completeness: s.completeness })
        .eq('code', s.code);
    }
  }

  function toggleLanguage(code: string) {
    setLanguages(prev => prev.map(l => l.code === code ? { ...l, selected: !l.selected } : l));
  }

  function selectAll() {
    setLanguages(prev => prev.map(l => ({ ...l, selected: l.missingKeys > 0 })));
  }

  function deselectAll() {
    setLanguages(prev => prev.map(l => ({ ...l, selected: false })));
  }

  async function startBulkTranslation() {
    const selectedLangs = languages.filter(l => l.selected && l.missingKeys > 0);
    if (selectedLangs.length === 0) {
      toast.info(bt.noLanguagesSelected || 'No languages with missing translations selected');
      return;
    }

    setTranslating(true);
    setResults([]);
    setProgress(0);

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      toast.error(bt.mustBeLoggedIn || 'You must be logged in');
      setTranslating(false);
      return;
    }

    // Client-side batch size per function call to avoid edge function timeout
    const CLIENT_BATCH_SIZE = 50;
    let creditsExhausted = false;

    for (let i = 0; i < selectedLangs.length; i++) {
      if (creditsExhausted) break;

      const lang = selectedLangs[i];
      setCurrentLang(`${lang.flag} ${lang.name}`);
      setProgress(Math.round((i / selectedLangs.length) * 100));

      try {
        const missingEntries = getMissingKeys(lang.code);
        const { validKeys: existingValidKeys } = await fetchOverrideKeyStatsForLanguage(lang.code, canonicalEnglishKeySet);
        const toTranslate = missingEntries.filter(e => !existingValidKeys.has(e.key));

        if (toTranslate.length === 0) {
          setResults(prev => [...prev, { lang: lang.name, translated: 0, total: 0 }]);
          continue;
        }

        let totalTranslated = 0;
        let batchFailures = 0;
        const MAX_BATCH_FAILURES = 3;

        // Split into smaller batches to avoid edge function timeout
        for (let batchStart = 0; batchStart < toTranslate.length; batchStart += CLIENT_BATCH_SIZE) {
          if (creditsExhausted) break;

          const batch = toTranslate.slice(batchStart, batchStart + CLIENT_BATCH_SIZE);
          setCurrentLang(`${lang.flag} ${lang.name} (${Math.min(batchStart + CLIENT_BATCH_SIZE, toTranslate.length)}/${toTranslate.length})`);

          try {
            const { data, error } = await supabase.functions.invoke('translate-batch', {
              body: { targetLanguage: lang.code, targetLanguageName: lang.name, entries: batch },
            });

            if (error) {
              console.error(`Batch error for ${lang.code}:`, error);
              // Check for credits exhausted (402)
              if (error.message?.includes('402') || error.message?.includes('credits')) {
                creditsExhausted = true;
                toast.error(bt.creditsExhausted || 'AI credits exhausted. Try again later or run again to continue from where it stopped.');
                break;
              }
              batchFailures++;
              if (batchFailures >= MAX_BATCH_FAILURES) {
                console.warn(`Too many failures for ${lang.code}, moving to next language`);
                break;
              }
              // Wait longer after failure, then continue with next batch
              await new Promise(r => setTimeout(r, 5000));
              continue;
            }

            if (data?.error) {
              if (data.error.includes('credits') || data.error.includes('exhausted')) {
                creditsExhausted = true;
                toast.error(bt.creditsExhausted || 'AI credits exhausted. Try again later or run again to continue from where it stopped.');
                break;
              }
              console.warn(`${lang.name} batch warning: ${data.error}`);
              batchFailures++;
              if (batchFailures >= MAX_BATCH_FAILURES) break;
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }

            totalTranslated += data?.translated || 0;
            batchFailures = 0; // Reset on success

            // Pause between batches to avoid rate limiting
            if (batchStart + CLIENT_BATCH_SIZE < toTranslate.length) {
              await new Promise(r => setTimeout(r, 2000));
            }
          } catch (batchErr: any) {
            console.error(`Batch exception for ${lang.code}:`, batchErr);
            batchFailures++;
            if (batchFailures >= MAX_BATCH_FAILURES) break;
            await new Promise(r => setTimeout(r, 5000));
          }
        }

        setResults(prev => [...prev, { lang: lang.name, translated: totalTranslated, total: toTranslate.length }]);
      } catch (err: any) {
        console.error(`Translation error for ${lang.code}:`, err);
        toast.error(`${lang.name}: ${err.message}`);
        setResults(prev => [...prev, { lang: lang.name, translated: 0, total: 0 }]);
      }

      // Pause between languages to avoid rate limiting
      if (i < selectedLangs.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setProgress(100);
    setCurrentLang('');
    setTranslating(false);

    const totalDone = results.length;
    if (creditsExhausted) {
      toast.warning(bt.partialComplete || 'Translation partially complete — AI credits exhausted. Run again to continue from where it stopped.');
    } else {
      toast.success(bt.bulkTranslationComplete || 'Bulk translation complete!');
    }
    loadLanguageStatuses();
  }

  const selectedCount = languages.filter(l => l.selected).length;
  const totalMissing = languages.filter(l => l.selected).reduce((sum, l) => sum + l.missingKeys, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{bt.aiAutoTranslation || 'AI Auto-Translation'}</CardTitle>
          </div>
          <Badge variant="secondary">{totalKeys} {bt.totalKeys || 'total keys'}</Badge>
        </div>
        <CardDescription>
          {bt.description || 'Automatically translate all missing UI text to enabled languages using AI. Translations are stored in the database and merged at runtime.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {languages.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{bt.noEnabledLanguages || 'No enabled languages found. Enable languages in the language settings above.'}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>{bt.selectAll || 'Select All'}</Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>{bt.deselectAll || 'Deselect All'}</Button>
              <span className="text-sm text-muted-foreground ml-auto">
                {selectedCount} {bt.selected || 'selected'} · {totalMissing} {bt.keysToTranslate || 'keys to translate'}
              </span>
            </div>

            <ScrollArea className="h-[300px] rounded-md border p-3">
              <div className="space-y-2">
                {languages.map(lang => (
                  <div key={lang.code} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={lang.selected}
                      onCheckedChange={() => toggleLanguage(lang.code)}
                      disabled={translating || lang.missingKeys === 0}
                    />
                    <span className="text-lg">{lang.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{lang.name}</span>
                        <span className="text-xs text-muted-foreground">({lang.nativeName})</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={lang.completeness} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-10 text-right">{lang.completeness}%</span>
                      </div>
                    </div>
                    {lang.missingKeys === 0 ? (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> {bt.completeLabel || 'Complete'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                        {lang.missingKeys} {bt.missing || 'missing'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {translating && (
              <div className="space-y-2 p-3 rounded-md bg-muted/50 border">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{(bt.translating || 'Translating {lang}...').replace('{lang}', currentLang)}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <span className="text-xs text-muted-foreground">{progress}% {bt.complete || 'complete'}</span>
              </div>
            )}

            {results.length > 0 && !translating && (
              <div className="space-y-1 p-3 rounded-md bg-muted/30 border">
                <p className="text-sm font-medium mb-2">{bt.translationResults || 'Translation Results:'}</p>
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {r.translated > 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span>{r.lang}: {r.translated}/{r.total} {bt.keysTranslated || 'keys translated'}</span>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={startBulkTranslation}
              disabled={translating || selectedCount === 0 || totalMissing === 0}
              className="w-full"
              size="lg"
            >
              {translating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {bt.translatingBtn || 'Translating...'}
                </>
              ) : (
                <>
                  <Languages className="h-4 w-4 mr-2" />
                  {(bt.autoTranslate || 'Auto-Translate {count} Language(s) ({keys} keys)')
                    .replace('{count}', String(selectedCount))
                    .replace('{keys}', String(totalMissing))}
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
