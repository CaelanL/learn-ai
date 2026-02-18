import { createClient } from "./server";

// Get the authenticated user from the session.
// Returns the user or null if not authenticated.
// Use this in API routes to verify identity and get user_id.
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
