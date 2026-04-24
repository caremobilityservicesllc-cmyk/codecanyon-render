/**
 * Demo/Test Mode Configuration
 * 
 * Controls demo features across the application via environment variables.
 * 
 * Environment Variables:
 * - VITE_DEMO_MODE=true             → Master toggle for all demo features
 * - VITE_DEMO_BANNER=true           → Show "Demo Mode" banner in the UI
 * - VITE_DEMO_SEED_DATA=true        → Auto-invoke setup-demo-users edge function on login
 * - VITE_DEMO_WATERMARK=true        → Display watermark on pages
 * - VITE_DEMO_QUICK_LOGIN=true      → Show quick-access demo login buttons on auth pages
 * - VITE_DEMO_MOCK_PAYMENTS=true    → Simulate payment processing without real gateways
 * - VITE_DEMO_MOCK_MAPS=true        → Use mock map/route data without API keys
 * - VITE_DEMO_NOTIFICATIONS=true    → Show demo notification toasts on key actions
 * - VITE_DEMO_AI_CHATBOT=true       → Enable AI chatbot in demo mode
 * - VITE_DEMO_ANALYTICS=true        → Show sample analytics/revenue data
 * 
 * When VITE_DEMO_MODE=false (or omitted), ALL demo features are disabled
 * regardless of individual toggle values.
 */

/**
 * Master demo mode check. When false, no demo features are active.
 */
export const isDemoMode = (): boolean => {
  return import.meta.env.VITE_DEMO_MODE === 'true';
};

/**
 * Whether to show a persistent "Demo Mode" info banner at the top of the app.
 * Only active when master demo mode is ON. Defaults to true.
 */
export const showDemoBanner = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_BANNER !== 'false';
};

/**
 * Whether to auto-seed demo data (invoke setup-demo-users edge function)
 * when using quick-access demo login buttons.
 * Only active when master demo mode is ON. Defaults to true.
 */
export const shouldSeedDemoData = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_SEED_DATA !== 'false';
};

/**
 * Whether to show a "DEMO" watermark overlay on pages.
 * Only active when master demo mode is ON. Defaults to false (opt-in).
 */
export const showDemoWatermark = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_WATERMARK === 'true';
};

/**
 * Whether to show quick-access demo login buttons on /auth and /driver/login pages.
 * Only active when master demo mode is ON. Defaults to true.
 */
export const showDemoQuickLogin = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_QUICK_LOGIN !== 'false';
};

/**
 * Whether to simulate payment processing without hitting real payment gateways.
 * Useful for testing the full booking flow without configuring Stripe/PayPal/etc.
 * Only active when master demo mode is ON. Defaults to false (opt-in).
 */
export const useMockPayments = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_MOCK_PAYMENTS === 'true';
};

/**
 * Whether to use mock map/route data instead of real Google Maps / Mapbox APIs.
 * Avoids API costs during testing/demos. Shows placeholder route data.
 * Only active when master demo mode is ON. Defaults to false (opt-in).
 */
export const useMockMaps = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_MOCK_MAPS === 'true';
};

/**
 * Whether to show demo notification toasts when key actions occur.
 * Useful for demonstrating the notification system without real backend triggers.
 * Only active when master demo mode is ON. Defaults to false (opt-in).
 */
export const showDemoNotifications = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_NOTIFICATIONS === 'true';
};

/**
 * Whether to enable the AI chatbot widget in demo mode.
 * Only active when master demo mode is ON. Defaults to true.
 */
export const showDemoAIChatbot = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_AI_CHATBOT !== 'false';
};

/**
 * Whether to show sample analytics/revenue data in admin dashboard.
 * Useful for demos when there's no real booking data.
 * Only active when master demo mode is ON. Defaults to false (opt-in).
 */
export const showDemoAnalytics = (): boolean => {
  return isDemoMode() && import.meta.env.VITE_DEMO_ANALYTICS === 'true';
};

/**
 * Demo credentials for quick-access login buttons.
 * These are publicly documented and must NEVER be used in production.
 */
export const DEMO_CREDENTIALS = {
  user: { email: 'user@demo.com', password: 'User123!', label: 'User' },
  admin: { email: 'admin@demo.com', password: 'Admin123!', label: 'Admin' },
  driver: { email: 'driver@demo.com', password: 'Driver123!', label: 'Driver' },
} as const;

export type DemoRole = keyof typeof DEMO_CREDENTIALS;

/**
 * Summary of all demo mode settings for debugging/logging.
 */
export const getDemoConfig = () => ({
  enabled: isDemoMode(),
  banner: showDemoBanner(),
  seedData: shouldSeedDemoData(),
  watermark: showDemoWatermark(),
  quickLogin: showDemoQuickLogin(),
  mockPayments: useMockPayments(),
  mockMaps: useMockMaps(),
  notifications: showDemoNotifications(),
  aiChatbot: showDemoAIChatbot(),
  analytics: showDemoAnalytics(),
});
