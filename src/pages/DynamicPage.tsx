import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { usePageContent } from '@/hooks/usePageContent';
import { useLanguage } from '@/contexts/LanguageContext';

const DynamicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { page, loading } = usePageContent(slug || '');
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          {t.dynamicPage.backToHome}
        </Link>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : page ? (
          <>
            <h1 className="text-3xl font-bold mb-2">{page.title}</h1>
            {page.updated_at && (
              <p className="text-sm text-muted-foreground mb-8">{t.dynamicPage.lastUpdated}: {new Date(page.updated_at).toLocaleDateString()}</p>
            )}
            <div
              className="prose prose-sm dark:prose-invert max-w-none space-y-6"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-center py-12">{t.dynamicPage.pageNotFound}</p>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default DynamicPage;
