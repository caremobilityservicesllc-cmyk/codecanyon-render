export interface BookingDetails {
  // Service Info
  serviceType: ServiceType;
  transferType: TransferType;
  
  // Step 1
  pickupLocation: string;
  dropoffLocation: string;
  stops: string[]; // Additional stops
  pickupDate: Date | null;
  pickupTime: string;
  passengers: number;
  luggageCount: number; // Explicit luggage count
  childSeats: number; // Child seat request
  notes: string;
  flightNumber: string; // Flight tracking
  bookingHours: number; // Hourly service: number of hours booked
  
  // Route info from map calculation
  routeDistanceKm: number | null;
  routeDurationMinutes: number | null;
  
  // Step 2
  selectedVehicle: Vehicle | null;
  
  // Step 3
  paymentMethod: PaymentMethod | null;
  guestEmail: string;
  promoCode: string; // Promo/discount code
  promoCodeId: string | null; // Database promo code ID for usage tracking
  billingDetails: BillingDetails; // Optional billing details
  bankTransferDetails: BankTransferDetails; // Bank transfer proof
  agreedToTerms: boolean; // Terms acceptance
}

export interface BankTransferDetails {
  senderName: string;
  bankName: string;
  transferReference: string;
  transferDate: string;
  amountTransferred: string;
  notes: string;
}

export const initialBankTransferDetails: BankTransferDetails = {
  senderName: '',
  bankName: '',
  transferReference: '',
  transferDate: '',
  amountTransferred: '',
  notes: '',
};

export type ServiceType = 'hourly' | 'flat-rate';
export type TransferType = 'one-way' | 'return' | 'return-new-ride';

export interface Vehicle {
  id: string;
  name: string;
  category: string;
  passengers: number;
  luggage: number;
  image: string;
  features: string[];
  base_price?: number;
  price_per_km?: number;
  hourly_rate?: number;
  min_hours?: number;
  max_hours?: number;
}

export type PaymentMethod = 'card' | 'paypal' | 'bank';

export interface BillingDetails {
  fullName: string;
  companyName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  vatNumber: string;
}

export const initialBillingDetails: BillingDetails = {
  fullName: '',
  companyName: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  vatNumber: '',
};

export interface GlobalSettings {
  businessHours: {
    start: string;
    end: string;
  };
  currency: string;
  depositPercentage: number;
  pickupTimeInterval: number;
  maxStops: number; // NEW
  maxChildSeats: number; // NEW
}

export const GLOBAL_SETTINGS: GlobalSettings = {
  businessHours: {
    start: '06:00',
    end: '22:00',
  },
  currency: 'USD',
  depositPercentage: 30,
  pickupTimeInterval: 15,
  maxStops: 3,
  maxChildSeats: 3,
};

// Validation helper types
export interface ValidationError {
  field: string;
  message: string;
}

export interface Step1Validation {
  pickupLocation: string | null;
  dropoffLocation: string | null;
  pickupDate: string | null;
  pickupTime: string | null;
  passengers: string | null;
}
