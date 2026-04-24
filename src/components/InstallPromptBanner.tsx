import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPromptBanner() {
  const navigate = useNavigate();
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const ib = (t as any).installBanner || {};
  const appName = businessInfo.companyName || 'RideFlow';
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    
    if (!isMobile) return;

    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      setTimeout(() => setShowBanner(true), 3000);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      navigate('/install');
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', new Date().toISOString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in safe-area-bottom">
      <div className="mx-4 mb-4 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1 pr-6">
            <p className="font-medium text-foreground">
              {(ib.installApp || 'Install {appName}').replace('{appName}', appName)}
            </p>
            <p className="text-sm text-muted-foreground">
              {isIOS 
                ? (ib.addToHomeScreen || 'Add to home screen for quick access')
                : (ib.getAppBetter || 'Get the app for a better experience')}
            </p>
          </div>
        </div>
        
        <div className="mt-3 flex gap-2">
          <Button 
            size="sm" 
            className="flex-1 gap-2" 
            onClick={handleInstall}
          >
            <Download className="h-4 w-4" />
            {isIOS ? (ib.howToInstall || 'How to Install') : (ib.install || 'Install')}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleDismiss}
          >
            {ib.notNow || 'Not Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
