import { useRef } from 'react';
import { Navbar } from '@/components/booking/Navbar';
import { Footer } from '@/components/Footer';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Car, MapPin, Clock, CreditCard, Users, Shield, Smartphone, Globe,
  Bot, Zap, BarChart3, Bell, CalendarCheck, Share2, Star, Gift,
  FileText, Wallet, Route, Percent, Truck, Download, Printer,
  CheckCircle2, ChevronRight, Headphones, Map, TrendingUp
} from 'lucide-react';

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FeatureCategory {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  features: FeatureItem[];
}

export default function Features() {
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const companyName = businessInfo.companyName || 'RideFlow';

  const handlePrint = () => {
    window.print();
  };

  const ft = t.features;

  const categories: FeatureCategory[] = [
    {
      title: ft.bookingExperience,
      subtitle: ft.bookingExperienceSubtitle,
      icon: <Car className="h-5 w-5" />,
      color: 'text-primary',
      features: [
        { icon: <MapPin className="h-4 w-4" />, title: ft.threeStepBooking, description: ft.threeStepBookingDesc },
        { icon: <Users className="h-4 w-4" />, title: ft.guestBookings, description: ft.guestBookingsDesc },
        { icon: <CalendarCheck className="h-4 w-4" />, title: ft.recurringBookings, description: ft.recurringBookingsDesc },
        { icon: <Share2 className="h-4 w-4" />, title: ft.rideCostSplitting, description: ft.rideCostSplittingDesc },
        { icon: <Clock className="h-4 w-4" />, title: ft.realTimeTracking, description: ft.realTimeTrackingDesc },
        { icon: <CreditCard className="h-4 w-4" />, title: ft.multiplePayments, description: ft.multiplePaymentsDesc },
        { icon: <Percent className="h-4 w-4" />, title: ft.promoCodes, description: ft.promoCodesDesc },
        { icon: <Star className="h-4 w-4" />, title: ft.driverRatings, description: ft.driverRatingsDesc },
      ],
    },
    {
      title: ft.aiFeatures,
      subtitle: ft.aiFeaturesSubtitle,
      icon: <Bot className="h-5 w-5" />,
      color: 'text-accent',
      features: [
        { icon: <Bot className="h-4 w-4" />, title: ft.aiChatbot, description: ft.aiChatbotDesc },
        { icon: <Zap className="h-4 w-4" />, title: ft.surgePricing, description: ft.surgePricingDesc },
        { icon: <TrendingUp className="h-4 w-4" />, title: ft.trafficFares, description: ft.trafficFaresDesc },
        { icon: <Truck className="h-4 w-4" />, title: ft.smartDriverAssign, description: ft.smartDriverAssignDesc },
      ],
    },
    {
      title: ft.driverPortal,
      subtitle: ft.driverPortalSubtitle,
      icon: <Smartphone className="h-5 w-5" />,
      color: 'text-primary',
      features: [
        { icon: <Smartphone className="h-4 w-4" />, title: ft.mobileDashboard, description: ft.mobileDashboardDesc },
        { icon: <Map className="h-4 w-4" />, title: ft.gpsNavigation, description: ft.gpsNavigationDesc },
        { icon: <FileText className="h-4 w-4" />, title: ft.documentManagement, description: ft.documentManagementDesc },
        { icon: <Wallet className="h-4 w-4" />, title: ft.earningsPayouts, description: ft.earningsPayoutsDesc },
        { icon: <Gift className="h-4 w-4" />, title: ft.performanceBonuses, description: ft.performanceBonusesDesc },
        { icon: <Bell className="h-4 w-4" />, title: ft.realTimeNotifications, description: ft.realTimeNotificationsDesc },
      ],
    },
    {
      title: ft.adminDashboard,
      subtitle: ft.adminDashboardSubtitle,
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'text-accent',
      features: [
        { icon: <BarChart3 className="h-4 w-4" />, title: ft.realTimeAnalytics, description: ft.realTimeAnalyticsDesc },
        { icon: <Percent className="h-4 w-4" />, title: ft.dynamicPricingEngine, description: ft.dynamicPricingEngineDesc },
        { icon: <Route className="h-4 w-4" />, title: ft.zoneRouteManagement, description: ft.zoneRouteManagementDesc },
        { icon: <Users className="h-4 w-4" />, title: ft.driverManagement, description: ft.driverManagementDesc },
        { icon: <CreditCard className="h-4 w-4" />, title: ft.revenueRefunds, description: ft.revenueRefundsDesc },
        { icon: <Shield className="h-4 w-4" />, title: ft.settingsAuditLog, description: ft.settingsAuditLogDesc },
        { icon: <Zap className="h-4 w-4" />, title: ft.configurableCommission, description: ft.configurableCommissionDesc },
        { icon: <Bell className="h-4 w-4" />, title: ft.multiChannelNotifications, description: ft.multiChannelNotificationsDesc },
      ],
    },
    {
      title: ft.platformTechnical,
      subtitle: ft.platformTechnicalSubtitle,
      icon: <Shield className="h-5 w-5" />,
      color: 'text-primary',
      features: [
        { icon: <Smartphone className="h-4 w-4" />, title: ft.pwa, description: ft.pwaDesc },
        { icon: <Globe className="h-4 w-4" />, title: ft.multiLanguage, description: ft.multiLanguageDesc },
        { icon: <Shield className="h-4 w-4" />, title: ft.roleBasedAccess, description: ft.roleBasedAccessDesc },
        { icon: <Headphones className="h-4 w-4" />, title: ft.liveChatSupport, description: ft.liveChatSupportDesc },
        { icon: <Globe className="h-4 w-4" />, title: ft.whiteLabelReady, description: ft.whiteLabelReadyDesc },
        { icon: <CreditCard className="h-4 w-4" />, title: ft.paymentIntegrations, description: ft.paymentIntegrationsDesc },
      ],
    },
  ];

  const totalFeatures = categories.reduce((sum, cat) => sum + cat.features.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <Navbar />
      </div>

      <div ref={printRef} className="container mx-auto px-4 py-8 max-w-5xl print:max-w-none print:px-8">
        {/* Header */}
        <div className="text-center mb-10 space-y-4">
          <Badge variant="secondary" className="text-xs px-3 py-1">
            {ft.featuresCount.replace('{count}', String(totalFeatures))}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {ft.title.replace('{companyName}', companyName)}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
            {ft.subtitle}
          </p>
          <div className="flex items-center justify-center gap-3 print:hidden">
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              {ft.printSavePdf}
            </Button>
          </div>
        </div>

        <Separator className="mb-10" />

        {/* Feature Categories */}
        <div className="space-y-10">
          {categories.map((category, catIdx) => (
            <section key={catIdx} className="break-inside-avoid">
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center ${category.color}`}>
                  {category.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{category.title}</h2>
                  <p className="text-sm text-muted-foreground">{category.subtitle}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {category.features.map((feature, featIdx) => (
                  <Card key={featIdx} className="break-inside-avoid">
                    <CardContent className="p-4 flex gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        {feature.icon}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{feature.title}</h3>
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Footer />
      </div>
    </div>
  );
}
