import { useMemo, useCallback } from 'react';
import { BookingDetails, Step1Validation } from '@/types/booking';
import { isToday, isBefore, startOfDay, getDay } from 'date-fns';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function useBookingValidation(bookingDetails: BookingDetails) {
  const { businessHours } = useSystemSettings();
  const validateStep1 = useCallback((): Step1Validation => {
    const errors: Step1Validation = {
      pickupLocation: null,
      dropoffLocation: null,
      pickupDate: null,
      pickupTime: null,
      passengers: null,
    };

    // Pickup location
    if (!bookingDetails.pickupLocation.trim()) {
      errors.pickupLocation = 'Pickup location is required';
    } else if (bookingDetails.pickupLocation.length < 5) {
      errors.pickupLocation = 'Please enter a complete address';
    }

    // Dropoff location
    if (!bookingDetails.dropoffLocation.trim()) {
      errors.dropoffLocation = 'Drop-off location is required';
    } else if (bookingDetails.dropoffLocation.length < 5) {
      errors.dropoffLocation = 'Please enter a complete address';
    }

    // Same location check
    if (
      bookingDetails.pickupLocation.trim() &&
      bookingDetails.dropoffLocation.trim() &&
      bookingDetails.pickupLocation.toLowerCase().trim() === 
      bookingDetails.dropoffLocation.toLowerCase().trim()
    ) {
      errors.dropoffLocation = 'Drop-off must be different from pickup';
    }

    // Date validation
    if (!bookingDetails.pickupDate) {
      errors.pickupDate = 'Please select a pickup date';
    } else if (isBefore(startOfDay(bookingDetails.pickupDate), startOfDay(new Date()))) {
      errors.pickupDate = 'Cannot book for past dates';
    } else if (businessHours.daysOfWeek && businessHours.daysOfWeek.length > 0) {
      const dayName = DAY_NAMES[getDay(bookingDetails.pickupDate)];
      if (!businessHours.daysOfWeek.includes(dayName)) {
        errors.pickupDate = 'Bookings are not available on this day';
      }
    }

    // Time validation
    if (!bookingDetails.pickupTime) {
      errors.pickupTime = 'Please select a pickup time';
    } else if (bookingDetails.pickupDate && isToday(bookingDetails.pickupDate)) {
      // If booking for today, ensure time is in the future
      const now = new Date();
      const [hours, minutes] = bookingDetails.pickupTime.split(':').map(Number);
      const bookingTime = new Date();
      bookingTime.setHours(hours, minutes, 0, 0);
      
      if (isBefore(bookingTime, now)) {
        errors.pickupTime = 'Pickup time must be in the future';
      }
    }

    // Passengers
    if (bookingDetails.passengers < 1) {
      errors.passengers = 'At least 1 passenger required';
    } else if (bookingDetails.passengers > 8) {
      errors.passengers = 'Maximum 8 passengers allowed';
    }

    return errors;
  }, [bookingDetails]);

  const step1Errors = useMemo(() => validateStep1(), [validateStep1]);
  
  const isStep1Valid = useMemo(() => {
    return Object.values(step1Errors).every(error => error === null);
  }, [step1Errors]);

  const validateStep2 = useCallback(() => {
    const errors: { vehicle: string | null } = { vehicle: null };

    if (!bookingDetails.selectedVehicle) {
      errors.vehicle = 'Please select a vehicle';
    } else if (bookingDetails.selectedVehicle.passengers < bookingDetails.passengers) {
      errors.vehicle = `Selected vehicle only seats ${bookingDetails.selectedVehicle.passengers} passengers`;
    } else if (bookingDetails.selectedVehicle.luggage < bookingDetails.luggageCount) {
      errors.vehicle = `Selected vehicle only fits ${bookingDetails.selectedVehicle.luggage} bags`;
    }

    return errors;
  }, [bookingDetails]);

  const step2Errors = useMemo(() => validateStep2(), [validateStep2]);
  
  const isStep2Valid = useMemo(() => {
    return Object.values(step2Errors).every(error => error === null);
  }, [step2Errors]);

  const validateStep3 = useCallback(() => {
    const errors: { 
      paymentMethod: string | null; 
      email: string | null;
      terms: string | null;
    } = { 
      paymentMethod: null, 
      email: null,
      terms: null,
    };

    if (!bookingDetails.paymentMethod) {
      errors.paymentMethod = 'Please select a payment method';
    }

    // Guest email validation
    if (!bookingDetails.guestEmail) {
      // Will be validated in component based on user login state
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(bookingDetails.guestEmail)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    if (!bookingDetails.agreedToTerms) {
      errors.terms = 'You must agree to the terms and conditions';
    }

    return errors;
  }, [bookingDetails]);

  const step3Errors = useMemo(() => validateStep3(), [validateStep3]);

  return {
    step1Errors,
    step2Errors,
    step3Errors,
    isStep1Valid,
    isStep2Valid,
    validateStep1,
    validateStep2,
    validateStep3,
  };
}
