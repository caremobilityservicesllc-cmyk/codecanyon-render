import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Smartphone, Check, Share, Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { useLanguage } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const navigate = useNavigate();
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const appName = businessInfo.companyName || 'RideFlow';
  const logoSrc = useBrandLogo();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));
    const handleBeforeInstall = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <Link to="/" className="transition-opacity hover:opacity-90" aria-label="Go to home">
              <img src={logoSrc} alt={`${appName} Logo`} className="h-24 w-24 rounded-2xl shadow-lg object-contain" />
            </Link>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">{t.install.title.replace('App', appName)}</h1>
          <p className="mt-2 text-muted-foreground">{t.install.installDescription.replace('our app', appName)}</p>

          {isInstalled ? (
            <div className="mt-8 rounded-xl border border-primary/30 bg-primary/10 p-6">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                  <Check className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground">{t.install.alreadyInstalled}</h2>
              <p className="mt-2 text-muted-foreground">{appName} {t.install.installedDescription}</p>
              <Button className="mt-4" onClick={() => navigate('/')}>{t.install.continueToApp}</Button>
            </div>
          ) : (
            <>
              {deferredPrompt && (
                <div className="mt-8">
                  <Button size="lg" className="gap-2 text-lg" onClick={handleInstall}>
                    <Download className="h-5 w-5" />
                    {t.install.installApp}
                  </Button>
                </div>
              )}
              {isIOS && !deferredPrompt && (
                <div className="mt-8 rounded-xl border border-border bg-card p-6 text-left">
                  <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t.install.installOnIphone}</h2>
                  <ol className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">1</div>
                      <div>
                        <p className="font-medium text-foreground">{t.install.tapShareButton}</p>
                        <p className="text-sm text-muted-foreground"><Share className="inline h-4 w-4" /> {t.install.shareButtonHint}</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">2</div>
                      <div>
                        <p className="font-medium text-foreground">{t.install.scrollAndTap}</p>
                        <p className="text-sm text-muted-foreground"><Plus className="inline h-4 w-4" /> {t.install.addToHomeScreen}</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">3</div>
                      <div>
                        <p className="font-medium text-foreground">{t.install.tapAdd}</p>
                        <p className="text-sm text-muted-foreground">{appName} {t.install.willAppearOnHome}</p>
                      </div>
                    </li>
                  </ol>
                </div>
              )}
              {isAndroid && !deferredPrompt && (
                <div className="mt-8 rounded-xl border border-border bg-card p-6 text-left">
                  <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t.install.installOnAndroid}</h2>
                  <ol className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">1</div>
                      <div>
                        <p className="font-medium text-foreground">{t.install.tapMenuButton}</p>
                        <p className="text-sm text-muted-foreground"><MoreVertical className="inline h-4 w-4" /> {t.install.menuButtonHint}</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">2</div>
                      <div>
                        <p className="font-medium text-foreground">{t.install.tapAddToHome}</p>
                        <p className="text-sm text-muted-foreground">{t.install.orInstallApp}</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">3</div>
                      <div>
                        <p className="font-medium text-foreground">{t.install.confirmInstallation}</p>
                        <p className="text-sm text-muted-foreground">{appName} {t.install.willBeAdded}</p>
                      </div>
                    </li>
                  </ol>
                </div>
              )}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <Smartphone className="mx-auto mb-2 h-8 w-8 text-primary" />
                  <p className="font-medium text-foreground">{t.install.quickAccess}</p>
                  <p className="text-sm text-muted-foreground">{t.install.quickAccessDesc}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <Download className="mx-auto mb-2 h-8 w-8 text-primary" />
                  <p className="font-medium text-foreground">{t.install.worksOffline}</p>
                  <p className="text-sm text-muted-foreground">{t.install.worksOfflineDesc}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <Check className="mx-auto mb-2 h-8 w-8 text-primary" />
                  <p className="font-medium text-foreground">{t.install.fastAndLight}</p>
                  <p className="text-sm text-muted-foreground">{t.install.fastAndLightDesc}</p>
                </div>
              </div>
            </>
          )}
          <div className="mt-8">
            <Button variant="ghost" onClick={() => navigate('/')}>{t.install.continueToWebsite}</Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
