import { format, parseISO, addHours } from 'date-fns';

interface BookingForExport {
  id: string;
  booking_reference: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  vehicle_name: string;
  passengers: number;
  notes?: string;
}

/**
 * Generate iCal (.ics) content for a booking
 */
export function generateICalEvent(booking: BookingForExport, companyName: string = 'RideFlow'): string {
  const [hours, minutes] = booking.pickup_time.split(':').map(Number);
  const startDate = parseISO(booking.pickup_date);
  startDate.setHours(hours, minutes, 0, 0);
  
  // Assume 1 hour duration for the ride
  const endDate = addHours(startDate, 1);
  
  const formatDateForICal = (date: Date): string => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };
  
  const uid = `${booking.id}@${companyName.toLowerCase().replace(/\s+/g, '')}.app`;
  const now = new Date();
  const dtstamp = formatDateForICal(now);
  const dtstart = formatDateForICal(startDate);
  const dtend = formatDateForICal(endDate);
  
  const summary = `${companyName}: ${booking.vehicle_name} - ${booking.booking_reference}`;
  const location = booking.pickup_location;
  const description = [
    `Booking Reference: ${booking.booking_reference}`,
    `Vehicle: ${booking.vehicle_name}`,
    `Passengers: ${booking.passengers}`,
    ``,
    `Pickup: ${booking.pickup_location}`,
    `Dropoff: ${booking.dropoff_location}`,
    booking.notes ? `Notes: ${booking.notes}` : '',
  ].filter(Boolean).join('\\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${companyName}//Booking Export//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Your ride is in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return icsContent;
}

/**
 * Generate iCal content for multiple bookings
 */
export function generateICalEvents(bookings: BookingForExport[], companyName: string = 'RideFlow'): string {
  const events = bookings.map(booking => {
    const [hours, minutes] = booking.pickup_time.split(':').map(Number);
    const startDate = parseISO(booking.pickup_date);
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = addHours(startDate, 1);
    
    const formatDateForICal = (date: Date): string => {
      return format(date, "yyyyMMdd'T'HHmmss");
    };
    
    const uid = `${booking.id}@${companyName.toLowerCase().replace(/\s+/g, '')}.app`;
    const now = new Date();
    const dtstamp = formatDateForICal(now);
    const dtstart = formatDateForICal(startDate);
    const dtend = formatDateForICal(endDate);
    
    const summary = `${companyName}: ${booking.vehicle_name} - ${booking.booking_reference}`;
    const location = booking.pickup_location;
    const description = [
      `Booking Reference: ${booking.booking_reference}`,
      `Vehicle: ${booking.vehicle_name}`,
      `Passengers: ${booking.passengers}`,
      ``,
      `Pickup: ${booking.pickup_location}`,
      `Dropoff: ${booking.dropoff_location}`,
      booking.notes ? `Notes: ${booking.notes}` : '',
    ].filter(Boolean).join('\\n');

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: Your ride is in 30 minutes',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${companyName}//Booking Export//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return icsContent;
}

/**
 * Download iCal file
 */
export function downloadICalFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar URL for a booking
 */
export function generateGoogleCalendarUrl(booking: BookingForExport, companyName: string = 'RideFlow'): string {
  const [hours, minutes] = booking.pickup_time.split(':').map(Number);
  const startDate = parseISO(booking.pickup_date);
  startDate.setHours(hours, minutes, 0, 0);
  const endDate = addHours(startDate, 1);
  
  const formatDateForGoogle = (date: Date): string => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };
  
  const title = encodeURIComponent(`${companyName}: ${booking.vehicle_name} - ${booking.booking_reference}`);
  const location = encodeURIComponent(booking.pickup_location);
  const details = encodeURIComponent([
    `Booking Reference: ${booking.booking_reference}`,
    `Vehicle: ${booking.vehicle_name}`,
    `Passengers: ${booking.passengers}`,
    '',
    `Pickup: ${booking.pickup_location}`,
    `Dropoff: ${booking.dropoff_location}`,
    booking.notes ? `Notes: ${booking.notes}` : '',
  ].filter(Boolean).join('\n'));
  
  const dates = `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`;
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}&details=${details}`;
}

/**
 * Generate Outlook Calendar URL for a booking
 */
export function generateOutlookCalendarUrl(booking: BookingForExport, companyName: string = 'RideFlow'): string {
  const [hours, minutes] = booking.pickup_time.split(':').map(Number);
  const startDate = parseISO(booking.pickup_date);
  startDate.setHours(hours, minutes, 0, 0);
  const endDate = addHours(startDate, 1);
  
  const title = encodeURIComponent(`${companyName}: ${booking.vehicle_name} - ${booking.booking_reference}`);
  const location = encodeURIComponent(booking.pickup_location);
  const body = encodeURIComponent([
    `Booking Reference: ${booking.booking_reference}`,
    `Vehicle: ${booking.vehicle_name}`,
    `Passengers: ${booking.passengers}`,
    '',
    `Pickup: ${booking.pickup_location}`,
    `Dropoff: ${booking.dropoff_location}`,
    booking.notes ? `Notes: ${booking.notes}` : '',
  ].filter(Boolean).join('\n'));
  
  const startiso = startDate.toISOString();
  const endiso = endDate.toISOString();
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startiso}&enddt=${endiso}&location=${location}&body=${body}`;
}
