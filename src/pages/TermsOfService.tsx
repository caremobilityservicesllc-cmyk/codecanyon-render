import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { usePageContent } from '@/hooks/usePageContent';
import { useLanguage } from '@/contexts/LanguageContext';

const defaultContent = (companyName: string, email?: string) => `
<section>
  <h2 class="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
  <p class="text-muted-foreground leading-relaxed">By accessing or using the services provided by ${companyName} ("we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">2. Description of Service</h2>
  <p class="text-muted-foreground leading-relaxed">${companyName} provides a transportation booking platform that connects passengers with professional drivers. Our services include ride booking, scheduling, payment processing, and related features.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">3. User Accounts</h2>
  <p class="text-muted-foreground leading-relaxed">To use certain features of our service, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">4. Booking and Cancellation</h2>
  <p class="text-muted-foreground leading-relaxed">All bookings are subject to availability. We reserve the right to cancel or modify bookings due to unforeseen circumstances. Cancellation policies, including any applicable fees, are displayed at the time of booking.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">5. Payment Terms</h2>
  <p class="text-muted-foreground leading-relaxed">By using our services, you agree to pay all fees and charges associated with your bookings. Prices are displayed in the currency configured by ${companyName}.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">6. User Conduct</h2>
  <p class="text-muted-foreground leading-relaxed">You agree to use our services responsibly and in accordance with all applicable laws.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
  <p class="text-muted-foreground leading-relaxed">To the fullest extent permitted by law, ${companyName} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with the use of our services.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">8. Changes to Terms</h2>
  <p class="text-muted-foreground leading-relaxed">We reserve the right to modify these terms at any time. Changes will be effective upon posting to this page.</p>
</section>
<section>
  <h2 class="text-xl font-semibold mb-3">9. Contact Information</h2>
  <p class="text-muted-foreground leading-relaxed">If you have questions about these Terms of Service, please contact us at ${email ? `<a href="mailto:${email}" class="text-primary underline hover:no-underline">${email}</a>` : 'our support team'}.</p>
</section>
`;

const TermsOfService = () => {
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const lp = (t as any).legalPages || {};
  const companyName = businessInfo?.companyName || (lp.ourCompany || 'Our Company');
  const { page, loading } = usePageContent('terms-of-service');

  const title = page?.title || (lp.termsOfService || 'Terms of Service');
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

export default TermsOfService;
