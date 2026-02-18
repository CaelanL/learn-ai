import { createClient } from "@supabase/supabase-js";

// Admin client — uses secret key, bypasses RLS
// Use this ONLY in API routes for blackboard operations
// where we need full access regardless of user
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  return createClient(url, key);
}
