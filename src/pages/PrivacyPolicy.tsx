import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { usePageContent } from '@/hooks/usePageContent';
import { useLanguage } from '@/contexts/LanguageContext';

const defaultContent = (companyName: string, email?: string) => `
<section>
  <h2 class="text-xl font-semibold mb-3">1. Information We Collect</h2>
  <p class="text-muted-foreground leading-relaxed">${companyName} collects information you provide directly, including your name, email address, phone number, payment information, and location data necessary for providing transportation services.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
  <p class="text-muted-foreground leading-relaxed">We use your information to provide and improve our services, process bookings and payments, communicate with you about your rides, send important updates, and ensure safety and security for all users.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">3. Information Sharing</h2>
  <p class="text-muted-foreground leading-relaxed">We share your information with drivers assigned to your bookings, payment processors to complete transactions, and law enforcement when required by law. We do not sell your personal information to third parties.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">4. Data Security</h2>
  <p class="text-muted-foreground leading-relaxed">We implement industry-standard security measures to protect your personal information, including encryption of data in transit and at rest.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">5. Cookies and Tracking</h2>
  <p class="text-muted-foreground leading-relaxed">We use cookies and similar technologies to enhance your experience, remember your preferences, and analyze usage patterns.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">6. Your Rights</h2>
  <p class="text-muted-foreground leading-relaxed">Depending on your jurisdiction, you may have the right to access, correct, delete, or port your personal data.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">7. Data Retention</h2>
  <p class="text-muted-foreground leading-relaxed">We retain your personal information for as long as necessary to provide our services, comply with legal obligations, and enforce our agreements.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">8. Changes to This Policy</h2>
  <p class="text-muted-foreground leading-relaxed">We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our platform.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">9. Contact Us</h2>
  <p class="text-muted-foreground leading-relaxed">If you have questions about this Privacy Policy, please contact us at ${email ? `<a href="mailto:${email}" class="text-primary underline hover:no-underline">${email}</a>` : 'our support team'}.</p>
</section>
`;

const PrivacyPolicy = () => {
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const lp = (t as any).legalPages || {};
  const companyName = businessInfo?.companyName || (lp.ourCompany || 'Our Company');
  const { page, loading } = usePageContent('privacy-policy');

  const title = page?.title || (lp.privacyPolicy || 'Privacy Policy');
  const content = page?.content?.trim() 
    ? page.content 
    : defaultContent(companyName, businessInfo?.email);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          {t.nav.backToHome}
        </Link>

        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">{lp.lastUpdated || 'Last updated'}: {page?.updated_at ? new Date(page.updated_at).toLocaleDateString() : new Date().toLocaleDateString()}</p>

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

export default PrivacyPolicy;
