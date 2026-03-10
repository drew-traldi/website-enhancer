import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server-side client with service role (bypasses RLS) — use in API routes & scripts
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Client-side client with anon key — use in browser/Next.js components
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
