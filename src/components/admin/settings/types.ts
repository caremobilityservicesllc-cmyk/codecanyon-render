export type DistanceUnit = 'km' | 'miles';

export interface DistanceUnitSettings {
  unit: DistanceUnit;
}

export interface MapLocationSettings {
  defaultLat: number;
  defaultLng: number;
}

export interface BusinessInfo {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  timezone: string;
  website: string;
  taxId: string;
  registrationNumber: string;
  tagline: string;
}

export interface SocialLinks {
  facebook: string;
  twitter: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  youtube: string;
}

export interface BusinessHours {
  start: string;
  end: string;
  daysOfWeek: string[];
}

export interface BookingPolicies {
  depositPercentage: number;
  cancellationHours: number;
  minAdvanceBookingHours: number;
  maxAdvanceBookingDays: number;
  pickupTimeInterval: number;
  commissionPercentage: number;
  bookingFee: number;
  cancellationFee: number;
  enableTollCharges: boolean;
  enableAirportCharges: boolean;
  loyaltyPointsPerDollar: number;
  loyaltyRedemptionRate: number;
  driverMilestoneBonus: number;
  driverMilestoneRides: number;
}

export interface CurrencySettings {
  code: string;
  symbol: string;
  position: 'before' | 'after';
}

export interface TaxSettings {
  enabled: boolean;
  rate: number;
  label: string;
  includeInPrice: boolean;
}

export interface EmailSettings {
  senderName: string;
  senderEmail: string;
  sendConfirmations: boolean;
  sendReminders: boolean;
  reminderHoursBefore: number;
}

export interface SmsProviderConfig {
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  apiSecret?: string;
  fromNumber?: string;
}

export interface SmsSettings {
  enabled: boolean;
  provider: string;
  providerConfig: SmsProviderConfig;
  sendDriverArriving: boolean;
  sendRideUpdates: boolean;
}

export interface SecuritySettings {
  requireEmailVerification: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  twoFactorEnabled: boolean;
  ipWhitelist: string;
}

export interface AppearanceSettings {
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  darkModeDefault: boolean;
  pwaIconUrl: string;
  showPreloader: boolean;
}

export interface StripeSettings {
  enabled: boolean;
  mode: 'test' | 'live';
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
}

export interface PayPalSettings {
  enabled: boolean;
  mode: 'test' | 'live';
  publicKey: string;
  secretKey: string;
  clientId: string;
}

export interface BankTransferSettings {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  iban: string;
  instructions: string;
}


export interface FieldErrors {
  [key: string]: string;
}
