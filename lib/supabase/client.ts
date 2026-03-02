import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Return a mock client if env vars are not set (for UI preview)
  // This allows pages to render even without Supabase configured
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a minimal mock that won't crash
    return {
      auth: {
        signInWithPassword: async () => ({ data: null, error: { message: 'Supabase not configured. Please set up .env.local file.' } }),
        signUp: async () => ({ data: null, error: { message: 'Supabase not configured. Please set up .env.local file.' } }),
        signInWithOAuth: async () => ({ error: { message: 'Supabase not configured. Please set up .env.local file.' } }),
        signOut: async () => ({ error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as any
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

