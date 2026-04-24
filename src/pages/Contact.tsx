import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { usePageContent } from '@/hooks/usePageContent';
import { useTranslation } from '@/contexts/LanguageContext';

const Contact = () => {
  const { businessInfo } = useSystemSettings();
  const { page, loading } = usePageContent('contact');
  const { t } = useTranslation();

  const title = page?.title || t.contact.title;
  const content = page?.content?.trim() ? page.content : `<p class="text-muted-foreground">${t.contact.comingSoon}</p>`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          {t.contact.backToHome}
        </Link>

        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        {page?.updated_at && (
          <p className="text-sm text-muted-foreground mb-8">{t.time.lastUpdated}: {new Date(page.updated_at).toLocaleDateString()}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div 
            className="prose prose-sm dark:prose-invert max-w-none space-y-6"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
