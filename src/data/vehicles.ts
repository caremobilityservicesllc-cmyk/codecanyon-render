import { Vehicle } from '@/types/booking';

export const vehicles: Vehicle[] = [
  {
    id: 'luxury',
    name: 'First Class',
    category: 'Luxury',
    passengers: 3,
    luggage: 2,
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=250&fit=crop',
    features: ['Premium Everything', 'Champagne', 'Privacy Partition', 'Entertainment', 'Concierge'],
  },
  {
    id: 'van',
    name: 'Executive Van',
    category: 'Van',
    passengers: 8,
    luggage: 8,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop',
    features: ['Group Seating', 'Climate Control', 'WiFi', 'Luggage Space', 'USB Ports'],
  },
  {
    id: 'suv',
    name: 'Premium SUV',
    category: 'SUV',
    passengers: 6,
    luggage: 5,
    image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=400&h=250&fit=crop',
    features: ['Spacious Interior', 'Leather Seats', 'Climate Control', 'WiFi', 'Entertainment'],
  },
  {
    id: 'business',
    name: 'Business Class',
    category: 'Business',
    passengers: 4,
    luggage: 3,
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=400&h=250&fit=crop',
    features: ['Premium Leather', 'Climate Control', 'Refreshments', 'WiFi', 'Newspaper'],
  },
  {
    id: 'comfort',
    name: 'Comfort Plus',
    category: 'Comfort',
    passengers: 4,
    luggage: 3,
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=250&fit=crop',
    features: ['Leather Seats', 'Climate Control', 'USB Charging', 'WiFi'],
  },
  {
    id: 'economy',
    name: 'Economy Sedan',
    category: 'Economy',
    passengers: 4,
    luggage: 2,
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=250&fit=crop',
    features: ['Air Conditioning', 'USB Charging', 'WiFi'],
  },
];

export const vehicleCategories = ['All', 'Luxury', 'Van', 'SUV', 'Business', 'Comfort', 'Economy'];
