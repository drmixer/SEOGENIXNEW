import { createClient } from 'npm:@supabase/supabase-js@2'

// Note: supabase ANON KEY is required for client-side queries.
// If you are running tests, you may want to use the SERVICE ROLE KEY.
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
