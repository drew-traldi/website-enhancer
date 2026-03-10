export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      executives: {
        Row: Executive
        Insert: Omit<Executive, 'created_at'>
        Update: Partial<Omit<Executive, 'id'>>
        Relationships: []
      }
      cities: {
        Row: City
        Insert: Omit<City, 'id' | 'created_at'>
        Update: Partial<Omit<City, 'id' | 'created_at'>>
        Relationships: []
      }
      businesses: {
        Row: Business
        Insert: Omit<Business, 'id' | 'discovered_at'>
        Update: Partial<Omit<Business, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'businesses_city_id_fkey'
            columns: ['city_id']
            isOneToOne: false
            referencedRelation: 'cities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'businesses_assigned_executive_fkey'
            columns: ['assigned_executive']
            isOneToOne: false
            referencedRelation: 'executives'
            referencedColumns: ['id']
          },
        ]
      }
      website_scores: {
        Row: WebsiteScore
        Insert: Omit<WebsiteScore, 'id' | 'scored_at'>
        Update: Partial<Omit<WebsiteScore, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'website_scores_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
        ]
      }
      rebuilds: {
        Row: Rebuild
        Insert: Omit<Rebuild, 'id' | 'created_at'>
        Update: Partial<Omit<Rebuild, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'rebuilds_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
        ]
      }
      outreach: {
        Row: Outreach
        Insert: Omit<Outreach, 'id' | 'created_at'>
        Update: Partial<Omit<Outreach, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'outreach_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'outreach_rebuild_id_fkey'
            columns: ['rebuild_id']
            isOneToOne: false
            referencedRelation: 'rebuilds'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'outreach_executive_id_fkey'
            columns: ['executive_id']
            isOneToOne: false
            referencedRelation: 'executives'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export interface Executive {
  id: string               // D, S, E, I
  full_name: string
  title: string
  email: string
  phone: string | null
  pin_hash: string
  created_at: string
}

export interface City {
  id: string
  name: string
  state: string
  lat: number | null
  lng: number | null
  last_run_at: string | null
  total_businesses_found: number
  batches_completed: number
  created_at: string
}

export interface Business {
  id: string
  city_id: string
  place_id: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  google_rating: number | null
  google_review_count: number
  latest_review_date: string | null
  business_types: string[] | null
  photos: Json | null
  hours: Json | null
  is_chain: boolean
  chain_location_count: number | null
  is_active: boolean
  filter_status: string | null
  status: BusinessStatus
  assigned_executive: string | null
  notes: string | null
  discovered_at: string
  batch_number: number
}

export type BusinessStatus =
  | 'discovered'
  | 'filtered'
  | 'scored'
  | 'queued_for_rebuild'
  | 'rebuilding'
  | 'rebuilt'
  | 'email_sent'
  | 'manual_required'
  | 'responded'
  | 'converted'
  | 'skipped'

export interface WebsiteScore {
  id: string
  business_id: string
  overall_score: number | null
  responsive_score: number | null
  visual_era_score: number | null
  performance_score: number | null
  security_score: number | null
  accessibility_score: number | null
  tech_stack_score: number | null
  content_quality_score: number | null
  ux_score: number | null
  details: Json | null
  screenshot_before_url: string | null
  scored_at: string
}

export interface Rebuild {
  id: string
  business_id: string
  github_repo_url: string | null
  live_demo_url: string | null
  screenshot_after_url: string | null
  design_brief: Json | null
  status: 'queued' | 'building' | 'deployed' | 'failed'
  built_at: string | null
  created_at: string
}

export interface Outreach {
  id: string
  business_id: string
  rebuild_id: string | null
  executive_id: string | null
  contact_email: string | null
  contact_method: 'email' | 'manual_email' | 'in_person' | 'phone' | 'skipped'
  email_subject: string | null
  email_body: string | null
  sendgrid_message_id: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced: boolean
  status: 'draft' | 'sent' | 'opened' | 'clicked' | 'replied' | 'converted' | 'skipped'
  notes: string | null
  created_at: string
}

// Google Places API types
export interface PlaceResult {
  place_id: string
  name: string
  formatted_address?: string
  vicinity?: string
  geometry: {
    location: { lat: number; lng: number }
  }
  rating?: number
  user_ratings_total?: number
  types?: string[]
  website?: string
  formatted_phone_number?: string
  international_phone_number?: string
  photos?: Array<{ photo_reference: string; height: number; width: number }>
  opening_hours?: {
    open_now?: boolean
    weekday_text?: string[]
  }
  reviews?: Array<{
    rating: number
    time: number
    text: string
    author_name: string
  }>
}

export interface DiscoveryResult {
  businessesFound: number
  businessesFiltered: number
  businessesSaved: number
  city: string
  state: string
  batchNumber: number
}
