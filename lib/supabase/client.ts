import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/generated/database.types'
import { getPublicSupabaseConfig } from '@/lib/supabase/config'

export function createClient() {
  const { url, key } = getPublicSupabaseConfig()
  return createBrowserClient<Database>(
    url,
    key
  )
}
