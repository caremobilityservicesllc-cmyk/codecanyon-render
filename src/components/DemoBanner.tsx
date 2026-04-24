import { isDemoMode, showDemoBanner } from '@/utils/demoMode';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { t } = useLanguage();

  if (!showDemoBanner() || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-amber-950 text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 backdrop-blur-sm">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{(t as any).demo?.bannerText || 'Demo Mode Active — Data may be reset. Not for production use.'}</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 p-0.5 rounded hover:bg-amber-600/30 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
