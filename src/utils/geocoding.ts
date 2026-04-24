import { supabase } from "@/integrations/supabase/client";

/**
 * Geocode an address to [lat, lon] coordinates via the location-proxy edge function.
 */
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("location-proxy", {
      body: { type: "search", query: address, limit: 1 },
    });

    if (error) throw error;

    const results = typeof data === "string" ? JSON.parse(data) : data;
    if (results?.[0]) {
      return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    }
  } catch (err) {
    console.error("Geocode error:", err);
  }
  return null;
}

/**
 * Search for address suggestions (autocomplete) via the location-proxy edge function.
 */
export async function searchAddresses(query: string, limit = 5): Promise<any[]> {
  try {
    const { data, error } = await supabase.functions.invoke("location-proxy", {
      body: { type: "search", query, limit, addressdetails: 1 },
    });

    if (error) throw error;

    return typeof data === "string" ? JSON.parse(data) : data;
  } catch (err) {
    console.error("Address search error:", err);
    return [];
  }
}

/**
 * Reverse geocode lat/lon to an address string via the location-proxy edge function.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("location-proxy", {
      body: { type: "reverse", lat, lon },
    });

    if (error) throw error;

    const result = typeof data === "string" ? JSON.parse(data) : data;
    return result?.display_name || null;
  } catch (err) {
    console.error("Reverse geocode error:", err);
    return null;
  }
}
