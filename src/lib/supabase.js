import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase client
// Credentials are injected at build-time by Vite from the .env file.
// Required env vars (create a .env file at the project root):
//   VITE_SUPABASE_URL   = https://<your-project>.supabase.co
//   VITE_SUPABASE_ANON  = <your anon/public key>
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    "[Supabase] Missing env vars. Copy .env.example → .env and fill in your project URL and anon key."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
