import { Link } from 'react-router-dom';
import { Car, ExternalLink, Facebook, Twitter, Instagram, Linkedin, Youtube, Music2, Globe } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useAllPublishedPages } from '@/hooks/usePageContent';
import { useTranslation } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Language } from '@/i18n/translations';
import { useLanguagesFromDB } from '@/hooks/useLanguagesFromDB';

export function Footer() {
  const { businessInfo, socialLinks, enabledLanguages } = useSystemSettings();
  const { pages: customPages } = useAllPublishedPages();
  const { t, language, setLanguage } = useTranslation();
  const { activeLanguages: dbActiveLanguages } = useLanguagesFromDB();

  const availableLanguages = dbActiveLanguages.length > 0
    ? dbActiveLanguages.map(l => ({ code: l.code, name: l.name, nativeName: l.native_name, flag: l.flag }))
    : [];

  return (
    <footer className="relative z-20 border-t border-border bg-background mt-12">
      <div className="mx-auto max-w-6xl px-4 py-10 pb-28 sm:pb-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {/* Brand / Copyright */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 mb-2 lg:mb-0">
            <p className="text-sm font-semibold text-foreground mb-1">{businessInfo.companyName || 'RideFlow'}</p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {t.footer.copyright}.
            </p>
            <a
              href="/docs/index.html#changelog"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              v2.2.3
              <ExternalLink className="h-3 w-3" />
            </a>
            {(socialLinks.facebook || socialLinks.twitter || socialLinks.instagram || socialLinks.linkedin || socialLinks.tiktok || socialLinks.youtube) && (
              <div className="mt-3 flex items-center gap-2">
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Facebook">
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
                {socialLinks.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter">
                    <Twitter className="h-4 w-4" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Instagram">
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="LinkedIn">
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
                {socialLinks.tiktok && (
                  <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="TikTok">
                    <Music2 className="h-4 w-4" />
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="YouTube">
                    <Youtube className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.footer.legal}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.footer.privacy}
                </Link>
              </li>
              {customPages
                .filter(p => (p as any).footer_section === 'legal' && !['terms-of-service', 'privacy-policy'].includes(p.page_slug))
                .map(p => (
                  <li key={p.id}>
                    <Link to={`/page/${p.page_slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
                      {p.title}
                    </Link>
                  </li>
                ))
              }
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.footer.quickLinks}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.footer.contact}
                </Link>
              </li>
              <li>
                <Link to="/track" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.footer.trackBooking}
                </Link>
              </li>
              <li>
                <Link to="/install" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.footer.installApp}
                </Link>
              </li>
              {customPages
                .filter(p => ((p as any).footer_section === 'quick_links' || !(p as any).footer_section) && !['terms-of-service', 'privacy-policy', 'contact'].includes(p.page_slug))
                .map(p => (
                  <li key={p.id}>
                    <Link to={`/page/${p.page_slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
                      {p.title}
                    </Link>
                  </li>
                ))
              }
            </ul>
          </div>

          {/* Driver / Account */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.footer.drivers}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/driver/login" className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" />
                  {t.footer.driverLogin}
                </Link>
              </li>
            </ul>
          </div>

          {/* Language Selector */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="h-3.5 w-3.5 inline mr-1" />
              {t.settings?.language || 'Language'}
            </h4>
            <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="mr-2">{lang.flag}</span>
                    {lang.nativeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </footer>
  );
}
