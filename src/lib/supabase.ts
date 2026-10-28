import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://placeholder-project.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder-anon-key";

// Client-side singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side privileged client (uses SERVICE_ROLE_KEY if available for backend operations)
export function getServerSupabase() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder-anon-key";

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}
