export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          airport_charges: number | null
          bank_transfer_details: Json | null
          booking_fee: number | null
          booking_reference: string
          cancellation_fee: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          discount_amount: number | null
          driver_id: string | null
          driver_location_lat: number | null
          driver_location_lng: number | null
          dropoff_location: string
          estimated_arrival: string | null
          id: string
          notes: string | null
          passengers: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_date: string
          pickup_location: string
          pickup_time: string
          promo_code_id: string | null
          ride_completed_at: string | null
          ride_started_at: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["booking_status"]
          toll_charges: number | null
          total_price: number | null
          transfer_type: Database["public"]["Enums"]["transfer_type"]
          updated_at: string
          user_id: string | null
          vehicle_id: string
          vehicle_name: string
        }
        Insert: {
          airport_charges?: number | null
          bank_transfer_details?: Json | null
          booking_fee?: number | null
          booking_reference: string
          cancellation_fee?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          discount_amount?: number | null
          driver_id?: string | null
          driver_location_lat?: number | null
          driver_location_lng?: number | null
          dropoff_location: string
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          passengers?: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup_date: string
          pickup_location: string
          pickup_time: string
          promo_code_id?: string | null
          ride_completed_at?: string | null
          ride_started_at?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["booking_status"]
          toll_charges?: number | null
          total_price?: number | null
          transfer_type?: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
          user_id?: string | null
          vehicle_id: string
          vehicle_name: string
        }
        Update: {
          airport_charges?: number | null
          bank_transfer_details?: Json | null
          booking_fee?: number | null
          booking_reference?: string
          cancellation_fee?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          discount_amount?: number | null
          driver_id?: string | null
          driver_location_lat?: number | null
          driver_location_lng?: number | null
          dropoff_location?: string
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          passengers?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup_date?: string
          pickup_location?: string
          pickup_time?: string
          promo_code_id?: string | null
          ride_completed_at?: string | null
          ride_started_at?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["booking_status"]
          toll_charges?: number | null
          total_price?: number | null
          transfer_type?: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string
          vehicle_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_bonuses: {
        Row: {
          amount: number
          bonus_type: string
          created_at: string
          description: string | null
          driver_id: string
          id: string
          is_completed: boolean | null
          rides_completed: number | null
          rides_required: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          amount?: number
          bonus_type?: string
          created_at?: string
          description?: string | null
          driver_id: string
          id?: string
          is_completed?: boolean | null
          rides_completed?: number | null
          rides_required?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          bonus_type?: string
          created_at?: string
          description?: string | null
          driver_id?: string
          id?: string
          is_completed?: boolean | null
          rides_completed?: number | null
          rides_required?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_bonuses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          document_type: string
          document_url: string
          driver_id: string
          expires_at: string | null
          id: string
          rejection_reason: string | null
          status: string
          updated_at: string
          uploaded_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          document_url: string
          driver_id: string
          expires_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          document_url?: string
          driver_id?: string
          expires_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings: {
        Row: {
          amount: number
          booking_id: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          description: string | null
          driver_id: string
          earning_type: string
          gross_amount: number | null
          id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          driver_id: string
          earning_type?: string
          gross_amount?: number | null
          id?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          driver_id?: string
          earning_type?: string
          gross_amount?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payouts: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          payout_method: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          payout_method?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          payout_method?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          driver_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          driver_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_shifts: {
        Row: {
          check_in_at: string | null
          check_out_at: string | null
          created_at: string
          created_by: string | null
          driver_id: string
          end_time: string
          id: string
          notes: string | null
          shift_date: string
          start_time: string
          status: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          created_by?: string | null
          driver_id: string
          end_time: string
          id?: string
          notes?: string | null
          shift_date: string
          start_time: string
          status?: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          shift_date?: string
          start_time?: string
          status?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_shifts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          avatar_url: string | null
          average_rating: number | null
          background_check_date: string | null
          background_check_status: string | null
          completed_rides_this_month: number | null
          created_at: string
          current_location_lat: number | null
          current_location_lng: number | null
          documents_verified: boolean | null
          earnings_this_month: number | null
          earnings_total: number | null
          email: string | null
          first_name: string
          id: string
          insurance_expiry: string | null
          insurance_url: string | null
          is_active: boolean | null
          is_available: boolean | null
          last_name: string
          license_back_url: string | null
          license_expiry: string
          license_front_url: string | null
          license_number: string
          onboarding_status: string | null
          phone: string
          profile_photo_url: string | null
          rejection_reason: string | null
          total_rides: number | null
          updated_at: string
          user_id: string | null
          vehicle_registration_url: string | null
          verification_notes: string | null
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_rating?: number | null
          background_check_date?: string | null
          background_check_status?: string | null
          completed_rides_this_month?: number | null
          created_at?: string
          current_location_lat?: number | null
          current_location_lng?: number | null
          documents_verified?: boolean | null
          earnings_this_month?: number | null
          earnings_total?: number | null
          email?: string | null
          first_name: string
          id?: string
          insurance_expiry?: string | null
          insurance_url?: string | null
          is_active?: boolean | null
          is_available?: boolean | null
          last_name: string
          license_back_url?: string | null
          license_expiry: string
          license_front_url?: string | null
          license_number: string
          onboarding_status?: string | null
          phone: string
          profile_photo_url?: string | null
          rejection_reason?: string | null
          total_rides?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_registration_url?: string | null
          verification_notes?: string | null
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_rating?: number | null
          background_check_date?: string | null
          background_check_status?: string | null
          completed_rides_this_month?: number | null
          created_at?: string
          current_location_lat?: number | null
          current_location_lng?: number | null
          documents_verified?: boolean | null
          earnings_this_month?: number | null
          earnings_total?: number | null
          email?: string | null
          first_name?: string
          id?: string
          insurance_expiry?: string | null
          insurance_url?: string | null
          is_active?: boolean | null
          is_available?: boolean | null
          last_name?: string
          license_back_url?: string | null
          license_expiry?: string
          license_front_url?: string | null
          license_number?: string
          onboarding_status?: string | null
          phone?: string
          profile_photo_url?: string | null
          rejection_reason?: string | null
          total_rides?: number | null
          updated_at?: string
          user_id?: string | null
          vehicle_registration_url?: string | null
          verification_notes?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          booking_reference: string | null
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider: string
          recipient_email: string
          status: string
          subject: string
        }
        Insert: {
          booking_reference?: string | null
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          recipient_email: string
          status?: string
          subject: string
        }
        Update: {
          booking_reference?: string | null
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          recipient_email?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      favorite_vehicles: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          created_at: string
          flag: string
          id: string
          is_active: boolean
          name: string
          native_name: string
          translation_completeness: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          flag?: string
          id?: string
          is_active?: boolean
          name: string
          native_name: string
          translation_completeness?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          flag?: string
          id?: string
          is_active?: boolean
          name?: string
          native_name?: string
          translation_completeness?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_balances: {
        Row: {
          id: string
          lifetime_points: number
          tier: string
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          lifetime_points?: number
          tier?: string
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          lifetime_points?: number
          tier?: string
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_points: {
        Row: {
          created_at: string
          description: string | null
          id: string
          points: number
          points_type: string
          reference_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          points_type?: string
          reference_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          points_type?: string
          reference_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      map_api_usage: {
        Row: {
          api_type: string
          created_at: string
          id: string
          provider: string
          recorded_at: string
          request_count: number
        }
        Insert: {
          api_type: string
          created_at?: string
          id?: string
          provider: string
          recorded_at?: string
          request_count?: number
        }
        Update: {
          api_type?: string
          created_at?: string
          id?: string
          provider?: string
          recorded_at?: string
          request_count?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_booking_confirmations: boolean | null
          email_promotions: boolean | null
          email_ride_updates: boolean | null
          id: string
          push_enabled: boolean | null
          sms_driver_arriving: boolean | null
          sms_ride_updates: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_booking_confirmations?: boolean | null
          email_promotions?: boolean | null
          email_ride_updates?: boolean | null
          id?: string
          push_enabled?: boolean | null
          sms_driver_arriving?: boolean | null
          sms_ride_updates?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_booking_confirmations?: boolean | null
          email_promotions?: boolean | null
          email_ride_updates?: boolean | null
          id?: string
          push_enabled?: boolean | null
          sms_driver_arriving?: boolean | null
          sms_ride_updates?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          booking_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          sent_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          sent_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          sent_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      page_content: {
        Row: {
          content: string
          created_at: string
          footer_section: string
          id: string
          is_published: boolean
          meta_description: string | null
          page_slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          footer_section?: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          page_slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          footer_section?: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          page_slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          account_holder_name: string | null
          account_last_four: string | null
          bank_name: string | null
          card_brand: string | null
          card_expiry_month: number | null
          card_expiry_year: number | null
          card_last_four: string | null
          cardholder_name: string | null
          created_at: string
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          payment_type: string
          paypal_email: string | null
          updated_at: string
          user_id: string
          verification_amount_cents: number | null
          verification_attempts: number | null
          verification_expires_at: string | null
          verified_at: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_last_four?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_last_four?: string | null
          cardholder_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          payment_type?: string
          paypal_email?: string | null
          updated_at?: string
          user_id: string
          verification_amount_cents?: number | null
          verification_attempts?: number | null
          verification_expires_at?: string | null
          verified_at?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_last_four?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_last_four?: string | null
          cardholder_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          payment_type?: string
          paypal_email?: string | null
          updated_at?: string
          user_id?: string
          verification_amount_cents?: number | null
          verification_attempts?: number | null
          verification_expires_at?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          created_at: string
          days_of_week: Database["public"]["Enums"]["day_of_week"][] | null
          description: string | null
          end_time: string | null
          flat_fee: number
          id: string
          is_active: boolean
          max_distance_km: number | null
          min_distance_km: number | null
          multiplier: number
          name: string
          priority: number
          rule_type: Database["public"]["Enums"]["pricing_rule_type"]
          start_time: string | null
          updated_at: string
          vehicle_category: string | null
          vehicle_id: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          days_of_week?: Database["public"]["Enums"]["day_of_week"][] | null
          description?: string | null
          end_time?: string | null
          flat_fee?: number
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          min_distance_km?: number | null
          multiplier?: number
          name: string
          priority?: number
          rule_type: Database["public"]["Enums"]["pricing_rule_type"]
          start_time?: string | null
          updated_at?: string
          vehicle_category?: string | null
          vehicle_id?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          days_of_week?: Database["public"]["Enums"]["day_of_week"][] | null
          description?: string | null
          end_time?: string | null
          flat_fee?: number
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          min_distance_km?: number | null
          multiplier?: number
          name?: string
          priority?: number
          rule_type?: Database["public"]["Enums"]["pricing_rule_type"]
          start_time?: string | null
          updated_at?: string
          vehicle_category?: string | null
          vehicle_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_address: string | null
          billing_city: string | null
          billing_company_name: string | null
          billing_country: string | null
          billing_full_name: string | null
          billing_postal_code: string | null
          billing_state: string | null
          billing_vat_number: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language_preference: string | null
          phone: string | null
          preferred_vehicle: string | null
          theme_preference: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_full_name?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          billing_vat_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          language_preference?: string | null
          phone?: string | null
          preferred_vehicle?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_full_name?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          billing_vat_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language_preference?: string | null
          phone?: string | null
          preferred_vehicle?: string | null
          theme_preference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_code_uses: {
        Row: {
          booking_id: string | null
          id: string
          promo_code_id: string
          used_at: string
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          id?: string
          promo_code_id: string
          used_at?: string
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          id?: string
          promo_code_id?: string
          used_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_percentage: number
          id: string
          is_active: boolean
          max_uses: number | null
          max_uses_per_user: number | null
          min_booking_amount: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_percentage: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_booking_amount?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_percentage?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_booking_amount?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_bookings: {
        Row: {
          created_at: string
          custom_days: string[] | null
          dropoff_location: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          is_active: boolean | null
          last_generated_date: string | null
          notes: string | null
          passengers: number | null
          pickup_location: string
          pickup_time: string
          start_date: string
          template_booking_id: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          custom_days?: string[] | null
          dropoff_location: string
          end_date?: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          notes?: string | null
          passengers?: number | null
          pickup_location: string
          pickup_time: string
          start_date: string
          template_booking_id?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          custom_days?: string[] | null
          dropoff_location?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          notes?: string | null
          passengers?: number | null
          pickup_location?: string
          pickup_time?: string
          start_date?: string
          template_booking_id?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      ride_shares: {
        Row: {
          accepted_at: string | null
          booking_id: string
          cost_split_percentage: number | null
          counter_proposal_accepted_at: string | null
          created_at: string
          id: string
          is_accepted: boolean | null
          proposed_at: string | null
          proposed_by_user_id: string | null
          proposed_cost_split_percentage: number | null
          share_token: string
          shared_by_user_id: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          booking_id: string
          cost_split_percentage?: number | null
          counter_proposal_accepted_at?: string | null
          created_at?: string
          id?: string
          is_accepted?: boolean | null
          proposed_at?: string | null
          proposed_by_user_id?: string | null
          proposed_cost_split_percentage?: number | null
          share_token?: string
          shared_by_user_id: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          booking_id?: string
          cost_split_percentage?: number | null
          counter_proposal_accepted_at?: string | null
          created_at?: string
          id?: string
          is_accepted?: boolean | null
          proposed_at?: string | null
          proposed_by_user_id?: string | null
          proposed_cost_split_percentage?: number | null
          share_token?: string
          shared_by_user_id?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: []
      }
      routes: {
        Row: {
          base_price: number
          created_at: string
          destination_name: string
          destination_zone_id: string | null
          estimated_distance_km: number | null
          estimated_duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          origin_name: string
          origin_zone_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          destination_name: string
          destination_zone_id?: string | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          origin_name: string
          origin_zone_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          destination_name?: string
          destination_zone_id?: string | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          origin_name?: string
          origin_zone_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_destination_zone_id_fkey"
            columns: ["destination_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_zone_id_fkey"
            columns: ["origin_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default_dropoff: boolean | null
          is_default_pickup: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default_dropoff?: boolean | null
          is_default_pickup?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default_dropoff?: boolean | null
          is_default_pickup?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          setting_key: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          setting_key: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          setting_key?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      translation_overrides: {
        Row: {
          created_at: string
          id: string
          language_code: string
          translation_key: string
          translation_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_code: string
          translation_key: string
          translation_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language_code?: string
          translation_key?: string
          translation_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          base_price: number | null
          category: string
          created_at: string
          features: string[] | null
          hourly_rate: number | null
          id: string
          image: string | null
          is_active: boolean
          luggage: number
          max_hours: number | null
          min_hours: number | null
          name: string
          passengers: number
          price_per_km: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          category: string
          created_at?: string
          features?: string[] | null
          hourly_rate?: number | null
          id?: string
          image?: string | null
          is_active?: boolean
          luggage?: number
          max_hours?: number | null
          min_hours?: number | null
          name: string
          passengers?: number
          price_per_km?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          category?: string
          created_at?: string
          features?: string[] | null
          hourly_rate?: number | null
          id?: string
          image?: string | null
          is_active?: boolean
          luggage?: number
          max_hours?: number | null
          min_hours?: number | null
          name?: string
          passengers?: number
          price_per_km?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          multiplier: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_map_api_usage: {
        Args: { p_api_type: string; p_count?: number; p_provider: string }
        Returns: undefined
      }
      make_user_admin: { Args: { user_email: string }; Returns: undefined }
      record_driver_earning_with_commission: {
        Args: {
          p_booking_id: string
          p_commission_rate?: number
          p_description?: string
          p_driver_id: string
          p_gross_amount: number
        }
        Returns: string
      }
      use_promo_code: {
        Args: {
          p_booking_id?: string
          p_promo_code_id: string
          p_user_id?: string
        }
        Returns: undefined
      }
      validate_promo_code: {
        Args: { p_booking_amount?: number; p_code: string; p_user_id?: string }
        Returns: {
          discount_percentage: number
          message: string
          promo_code_id: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      notification_channel: "in_app" | "email" | "sms" | "push"
      notification_type:
        | "booking_confirmed"
        | "driver_assigned"
        | "driver_arriving"
        | "ride_started"
        | "ride_completed"
        | "ride_cancelled"
        | "reminder"
        | "promo"
        | "share_invitation"
        | "share_accepted"
        | "share_declined"
        | "share_counter_proposal"
      payment_method: "card" | "paypal" | "bank" | "crypto"
      pricing_rule_type: "time" | "distance" | "zone" | "vehicle"
      recurring_frequency: "daily" | "weekly" | "weekdays" | "custom"
      service_type: "hourly" | "flat-rate"
      transfer_type: "one-way" | "return" | "return-new-ride"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      notification_channel: ["in_app", "email", "sms", "push"],
      notification_type: [
        "booking_confirmed",
        "driver_assigned",
        "driver_arriving",
        "ride_started",
        "ride_completed",
        "ride_cancelled",
        "reminder",
        "promo",
        "share_invitation",
        "share_accepted",
        "share_declined",
        "share_counter_proposal",
      ],
      payment_method: ["card", "paypal", "bank", "crypto"],
      pricing_rule_type: ["time", "distance", "zone", "vehicle"],
      recurring_frequency: ["daily", "weekly", "weekdays", "custom"],
      service_type: ["hourly", "flat-rate"],
      transfer_type: ["one-way", "return", "return-new-ride"],
    },
  },
} as const
