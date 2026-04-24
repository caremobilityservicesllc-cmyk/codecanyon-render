import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SystemSettingsProvider } from "@/contexts/SystemSettingsContext";
import { ThemeProvider } from "next-themes";
import { BookingStatusNotifier } from "@/components/BookingStatusNotifier";
import { SetupGuard } from "@/components/setup/SetupGuard";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoWatermark } from "@/components/DemoWatermark";
import Index from "./pages/Index";
import Setup from "./pages/Setup";
import Auth from "./pages/Auth";
import DriverAuth from "./pages/DriverAuth";
import MyBookings from "./pages/MyBookings";
import Account from "./pages/Account";
import AcceptShare from "./pages/AcceptShare";
import TrackBooking from "./pages/TrackBooking";
import BookingConfirmationPage from "./pages/BookingConfirmation";
import Install from "./pages/Install";
import ResetPassword from "./pages/ResetPassword";
import Features from "./pages/Features";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Contact from "./pages/Contact";
import BookNow from "./pages/BookNow";
import NotFound from "./pages/NotFound";
import DynamicPage from "@/pages/DynamicPage";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminVehicles from "./pages/admin/AdminVehicles";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminZones from "./pages/admin/AdminZones";
import AdminRoutes from "./pages/admin/AdminRoutes";
import AdminPricing from "./pages/admin/AdminPricing";
import AdminPromoCodes from "./pages/admin/AdminPromoCodes";
import AdminPriceCalculator from "./pages/admin/AdminPriceCalculator";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminScheduling from "./pages/admin/AdminScheduling";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminDocumentReview from "./pages/admin/AdminDocumentReview";
import AdminDriverApplications from "./pages/admin/AdminDriverApplications";
import AdminPages from "./pages/admin/AdminPages";
import DriverDashboard from "./pages/DriverDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <SystemSettingsProvider>
        <LanguageProvider>
          <TooltipProvider>
            <BookingStatusNotifier />
            <DemoBanner />
            <DemoWatermark />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <SetupGuard>
              <Routes>
                <Route path="/setup" element={<Setup />} />
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/account" element={<Account />} />
                <Route path="/track" element={<TrackBooking />} />
                <Route path="/booking-confirmation/:id" element={<BookingConfirmationPage />} />
                <Route path="/install" element={<Install />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/features" element={<Features />} />
                <Route path="/share/:token" element={<AcceptShare />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/book-now" element={<BookNow />} />
                {/* Admin Routes */}
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/bookings" element={<AdminBookings />} />
                <Route path="/admin/customers" element={<AdminCustomers />} />
                <Route path="/admin/drivers" element={<AdminDrivers />} />
                <Route path="/admin/document-review" element={<AdminDocumentReview />} />
                <Route path="/admin/driver-applications" element={<AdminDriverApplications />} />
                <Route path="/admin/vehicles" element={<AdminVehicles />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
                <Route path="/admin/zones" element={<AdminZones />} />
                <Route path="/admin/routes" element={<AdminRoutes />} />
                <Route path="/admin/pricing" element={<AdminPricing />} />
                <Route path="/admin/promo-codes" element={<AdminPromoCodes />} />
                <Route path="/admin/calculator" element={<AdminPriceCalculator />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/scheduling" element={<AdminScheduling />} />
                <Route path="/admin/revenue" element={<AdminRevenue />} />
                <Route path="/admin/pages" element={<AdminPages />} />
                
                {/* Driver Routes */}
                <Route path="/driver/login" element={<DriverAuth />} />
                <Route path="/driver" element={<DriverDashboard />} />
                
                {/* Dynamic CMS Pages */}
                <Route path="/page/:slug" element={<DynamicPage />} />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </SetupGuard>
            </BrowserRouter>
          </TooltipProvider>
        </LanguageProvider>
        </SystemSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
